import { AccountNav } from "@/components/account-nav"
import { AppHeader } from "@/components/app-header"
import { AppRail } from "@/components/app-rail"
import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-svh flex-col bg-chrome text-foreground">
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-y-auto border-t bg-background md:rounded-t-2xl md:border-x">
          <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 md:p-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>/</BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage>Account</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-col gap-0.5">
              <h1 className="text-2xl font-semibold">Account</h1>
              <p className="text-sm text-muted-foreground">
                Manage your profile, preferences, and security.
              </p>
            </div>

            <div className="grid items-start gap-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-8">
              <AccountNav />
              <div className="flex min-w-0 flex-col gap-5">{children}</div>
            </div>
          </div>
        </main>
        <AppRail />
      </div>
    </div>
  )
}
