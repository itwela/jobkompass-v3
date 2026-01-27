import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const { data: { user } } = await supabase.auth.getUser()

  // Check if the path is protected
  const isProtectedRoute = request.nextUrl.pathname.includes('/dashboard')
  const isAuthRoute = request.nextUrl.pathname.includes('/auth')

  console.log('isprotected?', isProtectedRoute)
  
  /* 
  hHandling the case of:

  If a user IS NOT logged in and they are trying to access the dashboard.
  */
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  /* 
  hHandling the case of:

  If a user IS logged in and they are trying to access the log in page still.
  this will allow users to still browse the blog and home page,
  protect the auth pages from being abuse,
  and redirect them to the dashboard if they are already logged in and are trying to still access auth routes.
  */
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard/home"
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}