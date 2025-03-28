'use server';

import { revalidatePath } from "next/cache";
import { supabaseClientClient } from "../utils/supabase/client";
import { createSupServerInstance } from "../utils/supabase/server";


export async function quickAddJob({ job }: { job: any }) {
    
    "must call supabase server instance from within every server action and it will work."
    const supabase = await createSupServerInstance();
    /* 
    "id"
    "Company"
    "Status"
    "Link" 
    "Keywords"
    "Interviewed"
    "user_id"
    "Title"
    "Date Applied"
    "Resume used"
    "Cover letter used"
    "Description"
    "Skills"
    */ 

    console.log("job", job)

    const { data, error } = await supabase
        .from("Job").insert([
            { 
                "id": crypto.randomUUID(),
                "Company": job.Company,
                "Status": job.Status,
                "Link": job.Link, 
                "Keywords": job.Keywords,
                "Interviewed": job.Interviewed,
                "user_id": job.user_id,
                "Title": job.Title,
                "Date Applied": job["Date Applied"],
                "Resume used": job["Resume used"],
                "Cover letter used": job["Cover letter used"],
                "Description": job.Description,
                "Skills": job.Skills,
            }
    ]);
  
    if (error) {
      console.error("Error adding job:", error);
      throw new Error("Failed to add job");
    }
  
    return {
        status: 'success'
    };
}

// interface ResumeUpload {
//     file: File;
//     name: string;
//     type: string;
//     size: number;
//     lastModified: number;
// }

// all files like this will be the " thing " + " firstname " + " user id " + " filename "
export async function addResumeToDb(resume: FormData, user: any) {
    const supabase = await createSupServerInstance();
    
    const file = resume.get('resume') as File;
    const fileInfoStr = resume.get('fileInfo') as string;
    const fileInfo = JSON.parse(fileInfoStr);

    // check if filename exists in Profiles table resumes
    const { data: checkIfResumeExists, error: checkIfResumeExistsError } = await supabase
       .from("Profiles")
       .select("resumes")
       .eq("user_id", user?.[0]?.user_id);
    if (checkIfResumeExistsError) {
        console.error("Error checking if resume exists:", checkIfResumeExistsError);
        return {
            status: 'error',
            message: 'Failed to check if resume exists'
        };
    }

    if (checkIfResumeExists && checkIfResumeExists.length > 0 && checkIfResumeExists[0].resumes.includes(file.name)) {
        console.log("Resume already exists")
        return {
            status: 'error',
            message: 'Resume already exists'
        };
    }


    try {

        // Convert file to buffer for upload
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const userFN = user?.[0]?.firstName
        const userID = user?.[0]?.user_id

        const { data: addResumeToDbData, error: addResumeToDbError } = await supabase
            .storage
            .from('docs')
            // all files like this will be the " thing " / " firstname " - " user id " / " filename "
            .upload(`resumes/${userFN}-${userID}/${file.name}`, buffer, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: true  // Allow overwriting of files
        });

        if (addResumeToDbError) {
            console.log("Error uploading resume:", addResumeToDbError);
            return {
                status: 'error',
                message: 'Failed to upload resume to storage',
            };
        }

        const { data: currentResumeTitles, error: currentResumeTitlesError } = await supabase
            .from("Profiles")
            .select("resumes")
            .eq("user_id", userID)
            .single();

        const updatedResumes = [...(currentResumeTitles?.resumes || []), file.name];

        const { data: addResumeTitleToUserData, error: addResumeTitleToUserError  } = await supabase
            .from("Profiles")
            .update({
            resumes: updatedResumes
            })
        .eq("user_id", userID); // Use the user ID to target the specific user        
        
        if (addResumeTitleToUserError) {
            console.log("Error adding job:", addResumeTitleToUserError);
           
            revalidatePath('/dashboard', 'page');
            revalidatePath('/dashboard', 'layout');
            revalidatePath('/', 'page');
            revalidatePath('/', 'layout');

            return {
                status: 'error',
                message: 'Failed to add resume title to user table'
            };
        }

        revalidatePath('/dashboard', 'page');
        revalidatePath('/dashboard', 'layout');
        revalidatePath('/', 'page');
        revalidatePath('/', 'layout');

        return {
            status: 'success',
            message: 'File uploaded successfully'
        };

    } catch (error) {
        console.error("Error processing resume upload:", error);

        revalidatePath('/dashboard', 'page');
        revalidatePath('/dashboard', 'layout');
        revalidatePath('/', 'page');
        revalidatePath('/', 'layout');

        return {
            status: 'error',
            message: 'Failed to process resume upload'
        };
    }
}

export async function deleteResumeFromDb(resumeName: string, user: any) {
    const supabase = await createSupServerInstance();
    
    const userFN = user?.[0]?.firstName;
    const userID = user?.[0]?.user_id;

    try {
        // First, delete the file from storage
        const { data: deleteFromStorage, error: deleteFromStorageError } = await supabase
            .storage
            .from('docs')
            .remove([`resumes/${userFN}-${userID}/${resumeName}`]);

        if (deleteFromStorageError) {
            console.error("Error deleting resume from storage:", deleteFromStorageError);
            return {
                status: 'error',
                message: 'Failed to delete resume from storage'
            };
        }

        // Then, get current resume list
        const { data: currentResumes, error: getCurrentResumesError } = await supabase
            .from("Profiles")
            .select("resumes")
            .eq("user_id", userID)
            .single();

        if (getCurrentResumesError) {
            console.error("Error fetching current resumes:", getCurrentResumesError);
            return {
                status: 'error',
                message: 'Failed to fetch current resumes'
            };
        }

        // Filter out the deleted resume
        const updatedResumes = currentResumes.resumes.filter((resume: string) => resume !== resumeName);

        // Update the profile with new resumes array
        const { data: updateProfile, error: updateProfileError } = await supabase
            .from("Profiles")
            .update({
                resumes: updatedResumes
            })
            .eq("user_id", userID);

        if (updateProfileError) {
            console.error("Error updating profile:", updateProfileError);
            return {
                status: 'error',
                message: 'Failed to update resume list in profile'
            };
        }

        return {
            status: 'success',
            message: 'Resume deleted successfully'
        };

    } catch (error) {
        console.error("Error processing resume deletion:", error);
        return {
            status: 'error',
            message: 'Failed to process resume deletion'
        };
    }
}

export const addJobToDb = async (job: any) => {
    const supabase = await createSupServerInstance();
    const { data, error } = await supabase
      .from("Job").insert([
            {
                "id": crypto.randomUUID(),
                "Company": job.Company,
                "Status": job.Status,
                "Link": job.Link,
                "Keywords": job.Keywords,
                "Interviewed": job.Interviewed,
                "user_id": job.user_id,
                "Title": job.Title,
                "Date Applied": job["Date Applied"],
                "Resume used": job["Resume used"],
                "Cover letter used": job["Cover letter used"],
                "Description": job.Description,
                "Skills": job.Skills,
            }
    ]);
    if (error) {
        console.error("Error adding job:", error);
        return {
            status: 'error',
            message: 'Failed to add job'
        };
    }
    return {
        status:'success'
    };
}

export const updateJobStatusFromDb = async (jobId: string, status: string) => {
    const supabase = await createSupServerInstance();
    const { data, error } = await supabase
      .from("Job").update({
        Status: status
      })
      .eq("id", jobId);
    if (error) {
        console.error("Error updating job status:", error);
        return {
            status: 'error',
            message: 'Failed to update job status'
        };
    }
    console.log("Job updated successfully");
    return {
        status:'success'
    };
}


export const deleteJobFromDb = async (jobId: string) => {
    const supabase = await createSupServerInstance();
    const { data, error } = await supabase
       .from("Job").delete()
       .eq("id", jobId);
    if (error) {
        console.error("Error deleting job:", error);
        return {
            status: 'error',
            message: 'Failed to delete job'
        };
    }
    return {
        status:'success'
    };
}



export async function addCoverLetterToDb(cover: FormData, user: any) {
    const supabase = await createSupServerInstance();
    
    const file = cover.get('cover') as File;
    const fileInfoStr = cover.get('fileInfo') as string;
    const fileInfo = JSON.parse(fileInfoStr);

    // check if filename exists in Profiles table resumes
    const { data: checkIfCoverLetterExists, error: checkIfCoverLetterExistsError } = await supabase
       .from("Profiles")
       .select("cover_letters")
       .eq("user_id", user?.[0]?.user_id);
    if (checkIfCoverLetterExistsError) {
        console.error("Error checking if Cover Letter exists:", checkIfCoverLetterExistsError);
        return {
            status: 'error',
            message: 'Failed to check if Cover Letter exists'
        };
    }

    if (checkIfCoverLetterExists && checkIfCoverLetterExists.length > 0 && checkIfCoverLetterExists[0].cover_letters.includes(file.name)) {
        console.log("Cover Letter already exists")
        return {
            status: 'error',
            message: 'Cover Letter already exists'
        };
    }


    try {

        // Convert file to buffer for upload
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const userFN = user?.[0]?.firstName
        const userID = user?.[0]?.user_id

        const { data: addCoverLetterToDb , error: addCoverLetterToDbError } = await supabase
            .storage
            .from('docs')
            // all files like this will be the " thing " / " firstname " - " user id " / " filename "
            .upload(`cover/${userFN}-${userID}/${file.name}`, buffer, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: true  // Allow overwriting of files
        });

        if (addCoverLetterToDbError) {
            console.log("Error uploading Cover Letter:", addCoverLetterToDbError);
            return {
                status: 'error',
                message: 'Failed to upload Cover Letter to storage',
            };
        }

        const { data: currentCoverLetterTitles, error: currentCoverLetterError } = await supabase
            .from("Profiles")
            .select("cover_letters")
            .eq("user_id", userID)
            .single();

        if (currentCoverLetterError) {
            console.error("Error fetching current cover letters:", currentCoverLetterError);
            return {
                status: 'error',
                message: 'Failed to fetch current cover letters'
            };
        }

        const updatedCoverLetters = [...(currentCoverLetterTitles.cover_letters || []), file.name];

        const { data: addCoverLetterTitleToUserData, error: addCoverLetterTitleToUserError } = await supabase
            .from("Profiles")
            .update({
                cover_letters: updatedCoverLetters
            })
            .eq("user_id", userID);
        if (addCoverLetterTitleToUserError) {
            console.log("Error adding job:", addCoverLetterTitleToUserError);
            return {
                status: 'error',
                message: 'Failed to add resume title to user table'
            };
        }

        return {
            status: 'success',
            message: 'File uploaded successfully'
        };

    } catch (error) {
        console.error("Error processing resume upload:", error);
        return {
            status: 'error',
            message: 'Failed to process resume upload'
        };
    }
}



export async function addNewBioToDb(bioText: string, user: any) {
    const supabase = await createSupServerInstance();
    const userID = user?.[0]?.user_id;

    // First, get current bios
    const { data: currentBios, error: getBiosError } = await supabase
        .from("Profiles")
        .select("bios")
        .eq("user_id", userID)
        .single();

    if (getBiosError) {
        console.error("Error fetching current bios:", getBiosError);
        return {
            status: 'error',
            message: 'Failed to fetch current bios'
        };
    }

    // Generate bio title based on number of existing bios
    const bioCount = currentBios?.bios?.length || 0;
    const generatedBioTitle = `bio${bioCount + 1}`;

    // Create new bio object
    const newBio = {
        title: generatedBioTitle,
        text: bioText
    };

    // Combine existing bios with new bio
    const updatedBios = [...(currentBios?.bios || []), newBio];

    // Update the profile with new bios array
    const { data: addBioToDb, error: addBioToDbError } = await supabase
        .from("Profiles")
        .update({
            bios: updatedBios
        })
        .eq("user_id", userID);

    if (addBioToDbError) {
        console.error("Error adding bio:", addBioToDbError);
        return {
            status: 'error',
            message: 'Failed to add bio to user table'
        };
    }

    return {
        status: 'success',
        message: 'Bio uploaded successfully'
    };
}


export async function getUsersResume(resumeName: string, userName: string, userId: string) {
    const supabase = await createSupServerInstance();
    const filePath = `resumes/${userName}-${userId}/${resumeName}`;
    const { data, error } = await supabase
        .storage
        .from('docs')
        .download(filePath);
    if (error) {
        console.error("Error downloading resume:", error);
        return {
            status: 'error',
            message: 'Failed to download resume'
        };
    }

    // Convert Blob to ArrayBuffer
    const arrayBuffer = await data.arrayBuffer();
    
    return {
        data: arrayBuffer,
        type: data.type
    };
}