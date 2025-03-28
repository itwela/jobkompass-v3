'use server'

import { quickAddJob } from "../app/ai/prompts/databaseActions";
import StagehandConfig from "@/stagehand.config";
import { BrowserContext, Page, Stagehand, ObserveResult } from "@browserbasehq/stagehand";
import { z } from "zod";
import { AISdkClient } from "./aisdkClient";
import { deepseek } from "./deeepseekClient";
// import { JobKompassSdkClient } from "./jobKompassSdkClient";
// import { ollama } from "./jobKompassDeepseekClient";
    // SECTION -----------------------------------------------
      // NOTE STAGEHAND 
      export async function getJobInformationStagehand(url: string, userId: any) {
        
        console.log(url, userId)

        const stagehand = new Stagehand({
          ...StagehandConfig,
          llmClient: new AISdkClient({
            model: deepseek('deepseek-chat')
            // model: ollama('deepseek-r1:7b')
          }),
        });
        await stagehand.init();
      
        if (StagehandConfig.env === "BROWSERBASE" && stagehand.browserbaseSessionID) {
          console.log(
            `View this session live in your browser: https://browserbase.com/sessions/${stagehand.browserbaseSessionID}`
          );
        }
      
        const { page, context } = stagehand;
        async function jobInfo({page, context, stagehand, url}: { page: Page; context: BrowserContext; stagehand: Stagehand; url: string}) {
  
/*  ------------------------------------------------------------------------
          // NOTE - THIS IS THE QUICK ADD FEATURE BEHIND TH SCENES.
------------------------------------------------------------------------ */ 



// ------------------------------------------------------------------------
// TODO First, Go to the url provided.
            
          await page.goto(url);
// ------------------------------------------------------------------------ 

          await page.waitForLoadState('networkidle', { timeout: 20000 }); // Adjust timeout as needed
// ------------------------------------------------------------------------
// TODO Second, I want to get the Job Title and the Company Hiring for this position.

          // Extract all job information in one call
          let jobInfo;
          try {
            jobInfo = await page.extract({
              instruction: `Extract the following information from this job posting **accurately and completely**:

                1. **Title**: The most specific job title mentioned in the posting. Ensure this is the **exact** title as listed, avoiding generic roles if a more specific one is given.

                2. **Company**: The employer hiring for this role. Avoid recruiters or parent companies unless explicitly stated as the hiring entity.

                3. **Keywords**: Exactly three **highly relevant** industry-specific keywords that best describe this position:
                  - Must be **directly related** to the job’s core responsibilities.
                  - **Avoid generic terms** like "Technology" or "Engineering."
                  - If no strong keywords are found, return an empty string "".

                4. **Skills**: Extract key **technical and professional skills** required for this role, including:
                  - **Programming languages, frameworks, tools** (e.g., React, Python, SQL, AWS).
                  - **Industry-specific knowledge or certifications** (e.g., FAA Regulations for aviation roles).
                  - If no skills are listed, return an empty string "".

                5. **Description**: Provide a **concise but highly informative** summary of the job description:
                  - **DO NOT oversimplify or remove important context**—use as much of the job description as necessary while keeping it **concise and structured**.
                  - Extract and **highlight key responsibilities** of the role.
                  - Clearly identify what the job is looking for in an ideal candidate.
                  - If salary, benefits, or work arrangements (remote/hybrid/on-site) are mentioned, **include them in the summary**.
                  - **Avoid marketing fluff** like "Join our exciting team!"—focus only on the actual role and its requirements.

                6. **Easy Apply**:  
                  - Check if this job posting allows **one-click applications** (e.g., presence of name, email, resume upload fields).
                  - If both conditions are met, return **"Yes"**, otherwise **"No"**.
                  - Answer with **only "Yes" or "No"**—no additional text.

                **IMPORTANT NOTES**:
                - Ensure **precision** in extracted details.
                - **Do not skip** any important job-specific information.
                - If the page contains unrelated content, focus only on the **actual job description**.

                Here is the job page URL for reference: ${url}      
              `,
              useTextExtract: true,
              schema: z.object({
                "Title": z.string(),
                "Company": z.string(),
                "Keywords": z.array(z.string()),
                "Skills": z.array(z.string()),
                "Description": z.string(),
                "Easy apply": z.string(),
              }),
            });
          } catch (error) {
            console.error("Failed to extract job information:", error);
            throw new Error("Job information extraction failed");
          }

          // 5. Check Easy Apply Status
          // let deepseek_easy_apply;
          // try {
          //   const [{ selector: form, description: easy_apply }] = await page.observe({
          //     instruction: `You are on a job application page. Determine if this is an "Easy Apply" job by checking:
          //       - Presence of application form fields (name, email, resume, etc.)
          //       - Presence of a submit/apply button
          //       Answer with Yes ONLY if both conditions are met, otherwise No.
          //       Your returned answer should LITERALLY only be the word Yes or No depending on these parameters.
          //       `
          //   });
          //   deepseek_easy_apply = easy_apply;
          // } catch (error) {
          //   console.error("Failed to check easy apply status:", error);
          //   throw new Error("Easy apply status check failed");
          // }

          // Combine all results
          const getStarterJobInfo = {
            Title: jobInfo.Title,
            Company: jobInfo.Company,
            Keywords: jobInfo.Keywords,
            Skills: jobInfo.Skills,
            Description: jobInfo.Description,
            "Easy apply": jobInfo["Easy apply"],
          };
 // ------------------------------------------------------------------------ 



// ------------------------------------------------------------------------
// TODO Finally, I want to add this data and just more information to my database so we can start tracking jobs.
  
          const currentDate = new Date().toISOString().split('T')[0];
          const resultingObject = {
            "Company": getStarterJobInfo["Company"],
            "Status": "Interested",
            "Link": url,
            "Keywords": getStarterJobInfo["Keywords"],
            "Interviewed": false,
            "user_id": userId,
            "Title": getStarterJobInfo["Title"],
            "Date Applied": currentDate,
            "Resume used": "",
            "Cover letter used": "",
            "Description": getStarterJobInfo.Description,
            "Skills": getStarterJobInfo["Skills"],
            "Easy apply": getStarterJobInfo["Easy apply"],
          }

          const add = await quickAddJob({job: resultingObject})

          return {
            status: "success",
          }
 // ------------------------------------------------------------------------ 
 
        }
        const results = await jobInfo({ page, context, stagehand, url });
        await stagehand.close();
        console.log("Resulting Object Server", results)
        return results;
      }
      
      
// END --------------------------------------------------------
