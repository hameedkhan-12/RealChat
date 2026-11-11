import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/auth(.*)',
  '/portal(.*)',
  '/images(.*)',
  '/chatbot(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!.*\\..*|_next).*)', // Don't run middleware on static files
    '/', // Run middleware on index page  
    '/(api|trpc)(.*)', // Run middleware on API routes
  ],
}



// import { authMiddleware } from '@clerk/nextjs'

// export default authMiddleware({
//   publicRoutes: ['/', '/auth(.*)', '/portal(.*)', '/images(.*)'],
//   ignoredRoutes: ['/chatbot'],
// })

// export const config = {
//   matcher: ['/((?!.+.[w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
// }
