import { httpRouter } from "convex/server";
import { auth } from "./auth";
// import { httpAction } from "./_generated/server";
// import { internal } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);

// HTTP endpoint for agent to add resources
// http.route({
//   path: "/agent/addResource",
//   method: "POST",
//   handler: httpAction(async (ctx, request) => {
//     try {
//       const body = await request.json();
//       const { userId, title, url, description } = body;

//       if (!userId) {
//         return new Response(JSON.stringify({ error: "userId is required" }), {
//           status: 400,
//           headers: { "Content-Type": "application/json" },
//         });
//       }

//       const resourceId = await ctx.runMutation(internal.resources.addInternal, {
//         userId,
//         type: "resource",
//         title: title || "",
//         url: url || "",
//         description: description || "",
//       });

//       return new Response(
//         JSON.stringify({
//           success: true,
//           resourceId,
//           message: "Resource saved successfully",
//         }),
//         {
//           status: 200,
//           headers: { "Content-Type": "application/json" },
//         }
//       );
//     } catch (error: any) {
//       return new Response(
//         JSON.stringify({
//           error: error.message || "Failed to add resource",
//         }),
//         {
//           status: 500,
//           headers: { "Content-Type": "application/json" },
//         }
//       );
//     }
//   }),
// });

export default http;
