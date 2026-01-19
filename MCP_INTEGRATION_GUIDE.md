# MCP Server Integration Guide

This guide explains how to use resumake-mcp functionality in your Next.js web application.

## Overview

The [resumake-mcp](https://github.com/AndreaCadonna/resumake-mcp) server provides 9 professional LaTeX resume templates via the LaTeX Resume API. This guide shows you how to integrate similar functionality into your Next.js app.

## What You Have Now

✅ **Local LaTeX Compilation** - Working with Jake template  
✅ **API Route** - `/api/resume/generate` accepts resumake-mcp format  
✅ **Format Conversion** - Automatically converts resumake format to your internal format

## Options for Using Multiple Templates

### Option 1: Use LaTeX Resume API (Recommended for 9 Templates)

The resumake-mcp server uses an external API. To use it:

1. **Find the API Endpoint**
   - Check the resumake-mcp `server.js` file
   - Look for the API URL being called (likely `latexresu.me/api/...`)
   - The endpoint might be something like `/api/generate` or `/api/pdf`

2. **Add External API Support**
   ```typescript
   // In /app/api/resume/generate/route.ts
   if (useExternalAPI) {
     const apiResponse = await fetch('https://latexresu.me/api/generate', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         resumeData,
         template: resumeData.selectedTemplate || 1,
       }),
     });
     // Handle PDF response
   }
   ```

3. **Test the Endpoint**
   - You may need to reverse-engineer the exact endpoint format
   - Check browser network tab when using resumake.io manually
   - Or inspect the MCP server code directly

### Option 2: Add More Local Templates

To support multiple templates locally (requires LaTeX templates):

1. **Get LaTeX Templates**
   - Extract templates from resumake.io
   - Or find compatible templates on Overleaf/Latex templates repositories
   - Save them to `/templates/resume/template1.tex`, `template2.tex`, etc.

2. **Extend generateJakeLatex Function**
   ```typescript
   // In /lib/resume/generateJakeLatex.ts
   export function generateLatex(
     content: ResumeContentForJake, 
     templateId: number = 1
   ): string {
     const templatePath = path.join(
       process.cwd(), 
       'templates/resume', 
       `template${templateId}.tex`
     );
     // Load and populate template...
   }
   ```

3. **Update the API Route**
   - Modify `/api/resume/generate/route.ts` to use the selected template
   - Map `selectedTemplate` (1-9) to your local template files

### Option 3: Run MCP Server as Microservice

You can run the MCP server separately and call it from your Next.js app:

1. **Clone and Run MCP Server**
   ```bash
   git clone https://github.com/AndreaCadonna/resumake-mcp.git
   cd resumake-mcp
   npm install
   node server.js
   ```

2. **Create MCP Client in Next.js**
   ```typescript
   // /lib/mcpClient.ts
   export async function callMcpServer(tool: string, args: any) {
     // Use @modelcontextprotocol/sdk client to connect to MCP server
     // This requires running MCP server as a separate process
   }
   ```

3. **Proxy Through Next.js API Route**
   ```typescript
   // /app/api/mcp-proxy/route.ts
   export async function POST(req: Request) {
     // Forward requests to MCP server
   }
   ```

## Current Implementation

The `/api/resume/generate` endpoint:

✅ Accepts resumake-mcp format (`resumeData` object)  
✅ Converts to your internal format automatically  
✅ Generates PDF using local Jake template  
✅ Returns PDF as download

### Example Usage

```typescript
// Frontend or API client
const response = await fetch('/api/resume/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    resumeData: {
      selectedTemplate: 1, // Currently uses Jake template
      basics: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      work: [
        {
          company: 'Tech Corp',
          position: 'Software Engineer',
          startDate: '2022',
          endDate: 'Present',
          highlights: ['Built awesome features', 'Led team of 5'],
        },
      ],
      education: [
        {
          institution: 'University',
          studyType: 'Bachelor',
          endDate: '2022',
        },
      ],
    },
    filename: 'john-doe-resume',
  }),
});

const blob = await response.blob();
// Download or display PDF
```

## Next Steps

1. **Quick Start**: Use the current implementation with Jake template (works now!)
2. **Add External API**: Investigate LaTeX Resume API endpoint and add support
3. **Multi-Template**: Add more local templates if you have the LaTeX files
4. **MCP Integration**: Run MCP server separately if you want full feature parity

## Resources

- [resumake-mcp GitHub](https://github.com/AndreaCadonna/resumake-mcp)
- [LaTeX Resume Templates](https://www.overleaf.com/gallery/tagged/cv)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

## Notes

- The `selectedTemplate` parameter is accepted but currently always uses Jake template
- Folder organization (`folderPath`) is accepted but not yet implemented
- External API integration requires discovering the exact endpoint format
