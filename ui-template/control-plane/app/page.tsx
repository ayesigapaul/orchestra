import { AppHeader } from "@/components/app-header"
import { AppRail } from "@/components/app-rail"
import { AppSidebar } from "@/components/app-sidebar"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// Static placeholder bar — content slots to be filled with the platform's real data.
function Placeholder({ className }: { className?: string }) {
  return <Skeleton className={cn("animate-none", className)} />
}

export default function Page() {
  return (
    <div className="flex h-svh flex-col bg-chrome text-foreground">
      <AppHeader />

      {/* Shell: rails on chrome, content in a floating panel */}
      <div className="flex min-h-0 flex-1">
        <AppSidebar />

        <main className="min-w-0 flex-1 overflow-y-auto border-t bg-background md:rounded-t-2xl md:border-x">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#">Your work</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>/</BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage>Home</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            {/* Profile */}
            <div className="flex items-center gap-4">
              <Avatar className="size-14 ring-1 ring-foreground/10 md:size-16">
                <AvatarImage
                  src="https://github.com/shadcn.png"
                  alt="Ayesiga Paul"
                />
                <AvatarFallback>AP</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5">
                <h1 className="text-xl font-semibold md:text-2xl">
                  Ayesiga Paul
                </h1>
                <p className="text-sm text-muted-foreground">
                  Commit early, commit often
                </p>
              </div>
            </div>

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="flex flex-col gap-5">
                {/* Stat card placeholders */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Card key={index} className="gap-4">
                      <CardHeader>
                        <Placeholder className="h-4 w-24 max-w-full" />
                        <CardAction>
                          <Placeholder className="size-4 rounded-sm" />
                        </CardAction>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-2">
                        <Placeholder className="h-8 w-12" />
                        <Placeholder className="h-4 w-28 max-w-full" />
                        <Placeholder className="h-3 w-16" />
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Attention panel placeholder */}
                <Card>
                  <CardHeader>
                    <Placeholder className="h-4 w-56 max-w-full" />
                    <CardAction>
                      <Placeholder className="h-8 w-28 rounded-lg" />
                    </CardAction>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <Placeholder className="size-12 shrink-0 rounded-full" />
                      <div className="flex min-w-0 flex-col gap-2">
                        <Placeholder className="h-4 w-64 max-w-full" />
                        <Placeholder className="h-3 w-40 max-w-full" />
                      </div>
                    </div>
                    <Placeholder className="h-4 w-28" />
                  </CardContent>
                </Card>

                {/* Activity feed placeholder */}
                <Card>
                  <CardHeader>
                    <Placeholder className="h-4 w-48 max-w-full" />
                    <CardAction>
                      <Placeholder className="h-8 w-32 rounded-lg" />
                    </CardAction>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-5">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <Placeholder className="size-6 shrink-0 rounded-full" />
                        <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
                          <Placeholder className="h-4 w-3/4" />
                          <Placeholder className="h-3 w-1/2" />
                        </div>
                        <Placeholder className="h-3 w-20 shrink-0" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Quick access placeholder */}
              <Card>
                <CardHeader>
                  <Placeholder className="h-4 w-28" />
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="grid h-8 grid-cols-2 gap-0.5 rounded-lg border p-0.5">
                    <Placeholder className="h-full rounded-md" />
                    <div />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Placeholder className="h-3 w-full" />
                    <Placeholder className="h-3 w-4/5" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

        <AppRail />
      </div>
    </div>
  )
}
