# LaTeX Compilation Service Setup Guide

## Production outage (October 2026)

Resume and cover-letter PDFs compile on a separate service. Vercel `LATEX_SERVICE_URL` (all targets) is:

`https://jobkompass-latex-service-production.up.railway.app`

That Railway app is gone. `GET /health` and `POST /compile` (with either `latex` or `latexContent`) return HTTP 404:

```json
{"status":"error","code":404,"message":"Application not found"}
```

The Next.js export route treats any non-OK `/compile` response as `LaTeX compilation failed`, so every template fails the same way, including minimal input. Vercel runtime logs on `www.myjobkompass.com` show `LaTeX service error { status: 404, error: undefined, log: '' }` for `POST /api/resume/export/jake`, `POST /api/resume/export/mar`, and `POST /api/coverletter/export/jake` (all HTTP 500). This is not a bad TeX template. A blank compile `log` is now returned to the agent as `HTTP 404: empty body / Application not found`.

**P0 unblock:** restore a compiler at that exact URL, or deploy a replacement and point `LATEX_SERVICE_URL` at it. PDFs stay broken until `GET /health` is healthy and `POST /compile` returns a PDF. Do not change the Vercel env or Convex until that probe passes.

### Probe (run with the production URL)

```bash
LATEX_SERVICE_URL=https://jobkompass-latex-service-production.up.railway.app

curl -sS -m 20 -w "\nHTTP %{http_code}\n" "$LATEX_SERVICE_URL/health"

curl -sS -m 60 -w "\nHTTP %{http_code}\n" "$LATEX_SERVICE_URL/compile" \
  -H "Content-Type: application/json" \
  -d '{"latex":"\\documentclass{article}\\begin{document}Hello\\end{document}","filename":"probe-latex"}'

curl -sS -m 60 -w "\nHTTP %{http_code}\n" "$LATEX_SERVICE_URL/compile" \
  -H "Content-Type: application/json" \
  -d '{"latexContent":"\\documentclass{article}\\begin{document}Hello\\end{document}","filename":"probe-content"}'
```

Pass: `/health` is not the Railway 404 above, and both `/compile` calls return JSON with a non-empty `pdfBase64`. `latex` alone returning `latexContent is required` means the restored service still reads only `latexContent`. Clients in this repo send both names.

### Restore checklist

The service source is not in this repo. This file's recipe is Google Cloud Run, not Railway. Production was the Railway URL above.

1. Prefer redeploying the existing Railway service `jobkompass-latex-service-production` so the URL does not change. No Vercel env edit in that case. There is no Railway config or Dockerfile in this repository; recover it from the Railway project or rebuild from the `server.js` and `Dockerfile` samples below (`/health` and `/compile`).
2. If that Railway project cannot be restored, deploy a replacement with Step 5 (Cloud Run) or a new host, using a `server.js` that accepts both `latex` and `latexContent`.
3. A new host URL must be set as Vercel `LATEX_SERVICE_URL` on Production, Preview, and Development. That env change needs owner approval. Do not do it until the probe against the new URL passes.
4. Re-run the three curls above. Then generate one Jake resume and one Jake cover letter.
5. Convex does not call `/compile` itself. It calls the Next.js export routes. A Convex push is only required for the agent hint to read `log` when `details` is missing. This app's export routes now set both. Push Convex only when you want that hint change live.

## Overview

This guide will help you set up a Google Cloud Run service to handle LaTeX-to-PDF compilation. This solves the problem of `pdflatex` not being available in serverless environments.

## Why This Approach?

- **Problem**: Serverless functions (Vercel, etc.) don't have LaTeX installed
- **Solution**: Deploy a Docker container with LaTeX to Google Cloud Run
- **Result**: Your serverless function calls this service via HTTP API

## Architecture

```
Your Serverless Function (Vercel/Next.js)
    ↓ HTTP POST Request
Google Cloud Run Service (Docker with LaTeX)
    ↓ Compiles LaTeX
    ↓ Returns PDF (base64)
Your Serverless Function
    ↓ Saves to Convex
Done!
```

## Prerequisites & Learning Resources

### 1. Docker Basics (30-60 min)
**What you need to know:**
- What Docker is (containerization)
- How to build a Docker image
- Basic Dockerfile syntax

**Resources:**
- **Video**: [Docker in 100 Seconds](https://www.youtube.com/watch?v=Gjnup-PuquQ) - Fireship (quick overview)
- **Video**: [Docker Tutorial for Beginners](https://www.youtube.com/watch?v=fqMOX6JJhGo) - freeCodeCamp (1 hour, comprehensive)
- **Docs**: [Docker Official Getting Started](https://docs.docker.com/get-started/)

### 2. Google Cloud Platform Basics (30-45 min)
**What you need to know:**
- What Google Cloud is
- How to create a project
- How to use `gcloud` CLI
- What Cloud Run is

**Resources:**
- **Video**: [Google Cloud Run Tutorial](https://www.youtube.com/watch?v=2sYQ8LwUyqk) - Google Cloud Tech
- **Video**: [Cloud Run in 5 Minutes](https://www.youtube.com/watch?v=2sYQ8LwUyqk) - Quick start
- **Docs**: [Cloud Run Documentation](https://cloud.google.com/run/docs)
- **Docs**: [gcloud CLI Installation](https://cloud.google.com/sdk/docs/install)

### 3. Node.js/Express API Basics (15-30 min)
**What you need to know:**
- Creating a simple Express server
- Handling POST requests
- Returning JSON responses

**Resources:**
- **Video**: [Express.js in 1 Hour](https://www.youtube.com/watch?v=SccSCuHhOw0) - Programming with Mosh
- **Docs**: [Express.js Getting Started](https://expressjs.com/en/starter/installing.html)

## Step-by-Step Setup

### Step 1: Install Prerequisites

1. **Install Docker Desktop**
   - Download: https://www.docker.com/products/docker-desktop/
   - Verify: `docker --version`

2. **Install Google Cloud SDK (gcloud)**
   - Download: https://cloud.google.com/sdk/docs/install
   - Verify: `gcloud --version`

3. **Create Google Cloud Account**
   - Go to: https://console.cloud.google.com/
   - Sign up (free tier includes $300 credit)
   - Create a new project (or use existing)

### Step 2: Set Up Your Project Structure

Create a new directory for the LaTeX service:

```bash
mkdir latex-service
cd latex-service
```

### Step 3: Create the Service Files

#### 3.1 Create `package.json`

```json
{
  "name": "latex-compilation-service",
  "version": "1.0.0",
  "description": "LaTeX to PDF compilation service",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

#### 3.2 Create `server.js`

```javascript
const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const app = express();

// Increase payload size limit for large LaTeX files
app.use(express.json({ limit: '10mb' }));

app.post('/compile', async (req, res) => {
  // Accept both names. JobKompass clients send `latex` and `latexContent`
  // with the same TeX source. A service that reads only `latexContent`
  // returns 400 for a body that sent only `latex`, which fails every template.
  const latexContent = req.body.latexContent || req.body.latex;
  const filename = req.body.filename || 'document';

  if (!latexContent || typeof latexContent !== 'string') {
    return res.status(400).json({
      error: 'latexContent is required',
      log: 'Send the TeX source as JSON field "latexContent" (alias "latex" is also accepted).',
    });
  }

  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[${requestId}] Starting LaTeX compilation...`);

  const tempDir = '/tmp/compile';
  const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2);
  
  try {
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const texFile = path.join(tempDir, `${uniqueId}.tex`);
    const pdfPath = path.join(tempDir, `${uniqueId}.pdf`);
    const logPath = path.join(tempDir, `${uniqueId}.log`);
    
    // Write LaTeX content to file
    fs.writeFileSync(texFile, latexContent);
    console.log(`[${requestId}] LaTeX file written: ${texFile}`);
    
    // Compile LaTeX (two passes for references)
    console.log(`[${requestId}] Running first pdflatex pass...`);
    await execAsync(`pdflatex -interaction=nonstopmode -output-directory ${tempDir} ${texFile}`);
    
    console.log(`[${requestId}] Running second pdflatex pass...`);
    await execAsync(`pdflatex -interaction=nonstopmode -output-directory ${tempDir} ${texFile}`);
    
    // Check if PDF was generated
    if (!fs.existsSync(pdfPath)) {
      // Read log file for error details
      let logContent = '';
      if (fs.existsSync(logPath)) {
        logContent = fs.readFileSync(logPath, 'utf-8');
      }
      console.error(`[${requestId}] PDF not generated. Log:`, logContent);
      return res.status(500).json({ 
        error: 'PDF generation failed',
        log: logContent.substring(0, 2000)
      });
    }
    
    // Read PDF and convert to base64
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');
    
    console.log(`[${requestId}] PDF generated successfully (${pdfBuffer.length} bytes)`);
    
    // Cleanup
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn(`[${requestId}] Cleanup warning:`, cleanupError);
    }
    
    res.json({ 
      success: true, 
      pdfBase64,
      size: pdfBuffer.length
    });
    
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    
    // Try to read log file for debugging
    let logContent = '';
    const logPath = path.join(tempDir, `${uniqueId}.log`);
    if (fs.existsSync(logPath)) {
      try {
        logContent = fs.readFileSync(logPath, 'utf-8');
      } catch (e) {
        // Ignore
      }
    }
    
    // Cleanup on error
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    res.status(500).json({ 
      error: error.message || 'LaTeX compilation failed',
      log: logContent.substring(0, 2000)
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'latex-compilation' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LaTeX compilation service running on port ${PORT}`);
});
```

#### 3.3 Create `Dockerfile`

```dockerfile
# Use official TeX Live image (includes pdflatex and all packages)
FROM texlive/texlive:latest

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install Node.js dependencies
RUN apt-get update && \
    apt-get install -y nodejs npm && \
    npm install && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy server file
COPY server.js .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "server.js"]
```

#### 3.4 Create `.dockerignore`

```
node_modules
npm-debug.log
.git
.gitignore
README.md
```

### Step 4: Test Locally with Docker

1. **Build the Docker image:**
```bash
docker build -t latex-service .
```

2. **Run the container locally:**
```bash
docker run -p 3000:3000 latex-service
```

3. **Test the service.** Both field names must compile. `filename` is optional.

```bash
curl -X POST http://localhost:3000/compile \
  -H "Content-Type: application/json" \
  -d '{"latexContent": "\\documentclass{article}\\begin{document}Hello World\\end{document}", "filename": "test"}'

curl -X POST http://localhost:3000/compile \
  -H "Content-Type: application/json" \
  -d '{"latex": "\\documentclass{article}\\begin{document}Hello World\\end{document}", "filename": "test"}'
```

### Step 5: Deploy to Google Cloud Run

#### 5.1 Authenticate with Google Cloud

```bash
# Login to Google Cloud
gcloud auth login

# Set your project (replace YOUR_PROJECT_ID with your actual project ID)
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
```

#### 5.2 Build and Push to Google Container Registry

```bash
# Build and push to Google Container Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/latex-service

# Or use Artifact Registry (newer, recommended)
# First create a repository:
gcloud artifacts repositories create latex-repo \
  --repository-format=docker \
  --location=us-central1

# Then build and push:
gcloud builds submit --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/latex-repo/latex-service
```

#### 5.3 Deploy to Cloud Run

```bash
gcloud run deploy latex-service \
  --image gcr.io/YOUR_PROJECT_ID/latex-service \
  --platform managed \
  --region us-central1 \
  --memory 2Gi \
  --timeout 300 \
  --max-instances 10 \
  --allow-unauthenticated
```

**Or with Artifact Registry:**
```bash
gcloud run deploy latex-service \
  --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/latex-repo/latex-service \
  --platform managed \
  --region us-central1 \
  --memory 2Gi \
  --timeout 300 \
  --max-instances 10 \
  --allow-unauthenticated
```

#### 5.4 Get Your Service URL

After deployment, you'll get a URL like:
```
https://latex-service-xxxxx-uc.a.run.app
```

Save this URL - you'll need it for your environment variables.

### Step 6: Update Your Next.js Code

#### 6.1 Add Environment Variable

Add to your `.env` or `.env.production`:
```
LATEX_SERVICE_URL=https://latex-service-xxxxx-uc.a.run.app
```

#### 6.2 Modify `app/ai/tools/file.ts`

Replace the local `pdflatex` execution with a call to your service:

```typescript
// Around line 307-360, replace the pdflatex execution section with:

const LATEX_SERVICE_URL = process.env.LATEX_SERVICE_URL;

if (!LATEX_SERVICE_URL) {
  throw new Error('LATEX_SERVICE_URL environment variable is not set');
}

console.log(`[${toolExecutionId}] [RESUME_TOOL] Calling LaTeX compilation service...`);
const compileStartTime = Date.now();

try {
  const compileResponse = await fetch(`${LATEX_SERVICE_URL}/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latex: latexTemplate,
      latexContent: latexTemplate,
      filename: `resume-${uniqueId}`
    })
  });

  const compileDuration = Date.now() - compileStartTime;
  
  if (!compileResponse.ok) {
    const errorData = await compileResponse.json();
    console.error(`[${toolExecutionId}] [RESUME_TOOL] LaTeX service error`, {
      status: compileResponse.status,
      error: errorData.error,
      log: errorData.log
    });
    throw new Error(`LaTeX compilation failed: ${errorData.error}`);
  }

  const { pdfBase64, size } = await compileResponse.json();
  console.log(`[${toolExecutionId}] [RESUME_TOOL] PDF received from service`, {
    duration: `${compileDuration}ms`,
    size
  });

  // Convert base64 back to buffer
  const pdfBuffer = Buffer.from(pdfBase64, 'base64');
  
  // Continue with existing upload/save logic...
  
} catch (compileError) {
  console.error(`[${toolExecutionId}] [RESUME_TOOL] LaTeX service call failed:`, compileError);
  throw compileError;
}
```

### Step 7: Test End-to-End

1. Deploy your updated Next.js app
2. Try generating a resume
3. Check logs to verify the service is being called
4. Verify PDFs are being created

## Troubleshooting

### Service Not Responding
- `GET /health` or `POST /compile` returning HTTP 404 `{"status":"error","code":404,"message":"Application not found"}` means the host has no app. That is the current Railway outage, not a TeX error. See "Production outage" at the top of this file.
- Check Cloud Run logs: `gcloud run services logs read latex-service --region us-central1`
- Verify the service URL is correct
- Check if service is deployed: `gcloud run services list`

### PDF Generation Fails
- Check the log content in the error response
- Verify LaTeX template syntax
- Check Cloud Run logs for detailed errors
- A 400 `latexContent is required` means the service received `{ latex }` and does not read that alias yet. Clients in this repo send both `latex` and `latexContent`. Redeploy this service from the `server.js` sample above if a live probe with only `latexContent` succeeds and a probe with only `latex` returns that 400.

### Confirm the live `/compile` contract

The service source is not in this repository. `LATEX_SERVICE_URL` is a Vercel env var. Do not print the secret. Health check, then the same minimal document under each field name:

```bash
curl -sS -m 20 "$LATEX_SERVICE_URL/health"

curl -sS -m 60 -w "\nHTTP %{http_code}\n" "$LATEX_SERVICE_URL/compile" \
  -H "Content-Type: application/json" \
  -d '{"latex":"\\documentclass{article}\\begin{document}Hello\\end{document}","filename":"probe-latex"}'

curl -sS -m 60 -w "\nHTTP %{http_code}\n" "$LATEX_SERVICE_URL/compile" \
  -H "Content-Type: application/json" \
  -d '{"latexContent":"\\documentclass{article}\\begin{document}Hello\\end{document}","filename":"probe-content"}'
```

`latex` alone returning `latexContent is required` confirms the field mismatch. Both calls returning a base64 PDF means the service already accepts either name and a remaining failure is in the TeX log, not the field name.

### Timeout Issues
- Increase Cloud Run timeout: `gcloud run services update latex-service --timeout 300`
- Check memory allocation (2Gi should be enough)

### Cost Optimization
- Cloud Run only charges when requests are active
- First 2 million requests/month are free
- After that: ~$0.40 per million requests + compute time
- Typical cost: $5-20/month for moderate usage

## Additional Resources

### Google Cloud Run
- **Official Docs**: https://cloud.google.com/run/docs
- **Pricing Calculator**: https://cloud.google.com/products/calculator
- **Best Practices**: https://cloud.google.com/run/docs/tips

### Docker & LaTeX
- **TeX Live Docker Image**: https://hub.docker.com/r/texlive/texlive
- **Docker Best Practices**: https://docs.docker.com/develop/dev-best-practices/

### Monitoring
- Set up Cloud Run monitoring in Google Cloud Console
- Add logging to track usage and errors
- Set up alerts for service failures

## Next Steps

1. ✅ Complete Docker basics tutorial
2. ✅ Set up Google Cloud account
3. ✅ Create the service files
4. ✅ Test locally with Docker
5. ✅ Deploy to Cloud Run
6. ✅ Update your Next.js code
7. ✅ Test end-to-end
8. ✅ Monitor and optimize

## Support

If you run into issues:
- Check Cloud Run logs first
- Verify all environment variables are set
- Test the service endpoint directly with curl/Postman
- Review the LaTeX log content in error responses

Good luck! 🚀

---

## Problem Statement & Solution Summary

### The Problem

**Current Situation:**
- The application generates resumes and cover letters by compiling LaTeX templates to PDF
- The code uses `pdflatex` command-line tool to compile LaTeX files
- This works locally because the developer's machine has LaTeX installed
- **It fails in production** because serverless environments (Vercel, AWS Lambda, etc.) don't have LaTeX/pdflatex installed
- Error: `pdflatex is not installed or not in PATH`

**Why This Happens:**
- LaTeX distribution is large (several GB) and not included in standard serverless runtimes
- Serverless functions have limited system dependencies
- The code in `app/ai/tools/file.ts` tries to execute `pdflatex` directly using `execAsync()`

**Impact:**
- Document generation fails silently in production
- Users see "success" but no PDF is created
- No documents are saved to the database

### The Solution

**Approach:**
Deploy a separate Docker container service (on Google Cloud Run) that has LaTeX pre-installed, and call it via HTTP API from the serverless function.

**How It Works:**
1. Create a Node.js Express service that accepts LaTeX content via POST request
2. Service compiles LaTeX to PDF using `pdflatex` (which is available in the Docker container)
3. Service returns the PDF as base64-encoded string
4. Main serverless function calls this service instead of trying to run `pdflatex` locally
5. Main function receives the PDF and saves it to Convex database

**Key Changes Needed:**
1. Create the LaTeX compilation service (Docker container)
2. Deploy it to Google Cloud Run
3. Update `app/ai/tools/file.ts` to call the service via HTTP instead of executing `pdflatex` locally
4. Add `LATEX_SERVICE_URL` environment variable

**Files to Modify:**
- `app/ai/tools/file.ts` - Replace local `pdflatex` execution with HTTP call to service
- Environment variables - Add `LATEX_SERVICE_URL`

**Files to Create:**
- `latex-service/` directory with:
  - `server.js` - Express service that compiles LaTeX
  - `Dockerfile` - Docker image with LaTeX
  - `package.json` - Node.js dependencies

This solution maintains the existing LaTeX template workflow while making it work in serverless environments.

