--
-- Shapes every refusal the edge makes itself as a JSON:API error document, with the codes, titles
-- and retry safety the services use (ADR-0025; docs/30-protocol/http-conventions.md HC13). A
-- response from the Gateway passes through untouched: only what APISIX or nginx produce is shaped.
--
-- Two paths lead here. A plugin that refuses a request, openid-connect above all, exits through
-- core.response.exit, and the callback registered in rewrite() reshapes that exit. Errors nginx
-- raises itself, such as an upstream it cannot reach, never pass through a plugin, so config.yaml
-- sends them to a named location that calls error_page().
--
local core = require("apisix.core")
local ngx = ngx

local MEDIA_TYPE = "application/vnd.api+json"
local REQUEST_ID_HEADER = "Orchestra-Request-Id"
local INTERNAL_DETAIL =
    "The request could not be completed. Quote the request identifier when reporting it."

-- The registry entries for the statuses the edge produces. A 504 means the Gateway may have acted
-- before it stopped answering, which is exactly what upstream.outcome_unknown says.
local REFUSALS = {
    [400] = {status = 400, code = "request.malformed",
             title = "The request is malformed", retry = "unsafe"},
    [401] = {status = 401, code = "auth.unauthenticated",
             title = "A valid credential is required", retry = "unsafe"},
    [403] = {status = 403, code = "auth.forbidden",
             title = "This operation needs a grant the caller does not hold", retry = "unsafe"},
    [404] = {status = 404, code = "resource.not_found",
             title = "The resource does not exist", retry = "unsafe"},
    [405] = {status = 405, code = "request.method_not_allowed",
             title = "This method is not allowed on this path", retry = "unsafe"},
    [429] = {status = 429, code = "quota.exceeded",
             title = "A limit was reached", retry = "safe"},
    [502] = {status = 502, code = "upstream.outcome_unknown",
             title = "A dependency failed, and whether it acted is unknown", retry = "indeterminate"},
    [503] = {status = 503, code = "upstream.unavailable",
             title = "A dependency is unavailable", retry = "safe"},
}
REFUSALS[504] = REFUSALS[502]
local INTERNAL = {status = 500, code = "server.internal", title = "Something went wrong on our side"}


-- The refusal for a status, and its retry safety. A 4xx the registry has no code for is left alone,
-- because answering it as a server fault would be wrong in a way a default body is not.
local function refusal_for(status)
    local refusal = REFUSALS[status]
    if refusal then
        return refusal, refusal.retry
    end
    if status < 500 then
        return nil
    end
    -- HC10: a fault is safe to repeat on a read, and indeterminate otherwise.
    local method = ngx.req.get_method()
    return INTERNAL, (method == "GET" or method == "HEAD") and "safe" or "indeterminate"
end


local function error_document(refusal, retry)
    local request_id = ngx.var.request_id
    local error = {
        id = request_id,
        status = tostring(refusal.status),
        code = refusal.code,
        title = refusal.title,
        meta = {retry = retry},
    }
    if refusal == INTERNAL then
        error.detail = INTERNAL_DETAIL
    end
    return request_id, core.json.encode({jsonapi = {version = "1.1"}, errors = {error}})
end


-- openid-connect writes why a token failed into error_description. HC11 keeps the reason for the
-- log, so only the scheme, the realm and the error class reach the caller.
local function challenge()
    local offered = ngx.header["WWW-Authenticate"]
    if type(offered) == "table" then
        offered = offered[1]
    end
    local realm = offered and offered:match('realm="([^"]*)"') or "orchestra"
    local value = 'Bearer realm="' .. realm .. '"'
    if offered and offered:find('error="invalid_token"', 1, true) then
        value = value .. ', error="invalid_token"'
    end
    return value
end


-- openid-connect answers an Authorization header it cannot split into a scheme and a credential
-- with 400. That is a failed authentication, and it is answered as one.
local function malformed_credential()
    local authorization = ngx.req.get_headers()["Authorization"]
    if type(authorization) == "table" then
        return true
    end
    return authorization ~= nil and not authorization:find("^%S+%s+%S")
end


local function shape_exit(status, body, headers)
    if not status or status < 400 then
        return status, body, headers
    end
    if status == 400 and malformed_credential() then
        status = 401
    end
    local refusal, retry = refusal_for(status)
    if not refusal then
        core.log.warn("no registered code for status ", status, "; the refusal is not shaped")
        return status, body, headers
    end

    headers = headers or {}
    if refusal.status == 401 then
        headers["WWW-Authenticate"] = challenge()
    end
    local request_id, document = error_document(refusal, retry)
    headers["Content-Type"] = MEDIA_TYPE
    headers[REQUEST_ID_HEADER] = request_id
    return refusal.status, document, headers
end


local plugin_name = "orchestra-json-api"
local schema = {type = "object", properties = {}}

local _M = {
    version = 0.1,
    -- Above every built-in plugin, so the callback exists before anything can refuse a request.
    priority = 25000,
    name = plugin_name,
    schema = schema,
}


function _M.check_schema(conf)
    return core.schema.check(schema, conf)
end


function _M.rewrite(_conf, _ctx)
    core.response.exit_insert_callback(shape_exit)
end


-- Content for the named location nginx's own errors are sent to. $status is the original status.
function _M.error_page()
    local refusal, retry = refusal_for(tonumber(ngx.var.status) or 500)
    refusal, retry = refusal or INTERNAL, retry or "indeterminate"
    local request_id, document = error_document(refusal, retry)
    ngx.status = refusal.status
    ngx.header["Content-Type"] = MEDIA_TYPE
    ngx.header[REQUEST_ID_HEADER] = request_id
    ngx.print(document)
end


return _M
