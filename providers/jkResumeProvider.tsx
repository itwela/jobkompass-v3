'use client';

import { api } from '@/convex/_generated/api';
import { useQuery } from 'convex/react';
import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';

interface userFieldData {
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    citizenship: string;
    phone: string;
    location: string;
    website: string;
    socials: Array<{type: string, url: string}>;
  };
  education: Array<{
    name: string;
    school: string;
    startDate: string;
    endDate: string;
    degree: string;
    field: string;
    date: string;
    details: string[];
    description: string;
    technologies: string[];
  }>;
  experience: Array<{
    title: string;
    company: string;
    location: string;
    date: string;
    description: string;
    details: string[];
  }>;
  projects: Array<{
    name: string;
    description: string;
    technologies: string[];
    date: string;
    details: string[];
    achievement: string;
    link: string;
  }>;
  skills: {
    technical: string[];
    additional: string[];
  };
  additionalInfo: {
    interests: string[];
    hobbies: string[];
    languages: string[];
    references: string[];
  };
}

interface JobKompassResumeContextType {

  userFieldData: userFieldData;
  setUserFieldData: React.Dispatch<React.SetStateAction<userFieldData>>;

  currentThemeName: string;
  setCurrentThemeName: (themeName: string) => void;

  currentJobForResumeCreation: any; 
  setCurrentJobForResumeCreation: (job: any) => void;

  complexFieldIndex: number;
  setComplexFieldIndex: (index: number) => void;
  complexFieldData: any;
  setComplexFieldData: (data: any) => void;
  readyToSaveComplexFields: boolean;
  setReadyToSaveComplexFields: (value: boolean) => void;

  handleCreateNewComplexField: (template: string, category: any) => void;
  handleSaveComplexFields: (template: string, index: number, data: any, category: any) => void;
  handleDeleteComplexField: (template: string, index: number, category: any) => void;
  
  clearResumeDataDeepseek: () => void;
  updateResumeWithAIDataDeepseek: (aiData: Partial<userFieldData>) => void;  

  customSymbol: any;
  setCustomSymbol: (symbol: any) => void;

  handleAddDetail: (category: string, index: number, newDetail: string) => void;
  handleRemoveDetail: (category: string, itemIndex: number, detailIndex: number) => void;

  currentResumeId: string | null;
  setCurrentResumeId: (id: string) => void;

  resumes: any[] | undefined;


}

const ResumeContext = createContext<JobKompassResumeContextType | null>(null);

export function JobKompassResumeProvider({ children }: { children: React.ReactNode }) {
  
  // STUB -------- CONSTS

  // const [userFieldData, setUserFieldData] = useState<userFieldData>({
  //   personalInfo: {
  //     firstName: "",
  //     lastName: "",
  //     email: "",
  //     citizenship: "US Citizen",
  //     phone: "(404) 555-0123",
  //     location: "Atlanta, GA",
  //     website: "itwela.dev",
  //     socials: [
  //       { type: 'github', url: 'Github.com/itwela' },
  //     ]
  //   },
  //   education: [
  //     {
  //       name: "Western Governors University (WGU)",
  //       school: "WGU",
  //       startDate: "",
  //       endDate: "December 2025",
  //       degree: "Bachelor of Science in Software Engineering",
  //       field: "Software Engineering",
  //       date: "Expected Graduation: December 2025",
  //       details: ["Studies focus on Math, Programming, Data Management, Application Design and Development, Cloud Foundations"],
  //       description: "",
  //       technologies: [],
  //     },
  //   ],
  //   experience: [
  //     {
  //       title: "Software Engineering Fellow",
  //       company: "Headstarter",
  //       location: "Long Island City, NY",
  //       date: "July 2024 - September 2024",
  //       description: "Built and deployed five AI projects focused on user-centered development and optimization",
  //       details: [
  //         "Built and deployed five AI projects focused on user-centered development and optimization, using React TS, Next.js, Tailwind, Firebase, Supabase, Clerk, LangChain, Pinecone, Docker, and Vercel",
  //         "Scaled web applications to over 200 users through collaboration with UI/UX designers, optimizing user interfaces based on feedback and quality testing across deployment stages",
  //         "Enhanced SDLC processes, including code reviews and QA testing, to ensure high performance and reliability",
  //         "Impact: Achieved funding and support for \"CitySwipe\" by winning multiple hackathons, leading to its launch with 100+ users"
  //       ],
  //     },
  //     {
  //       title: "AI Software Engineer",
  //       company: "Dataforce",
  //       location: "Atlanta, GA",
  //       date: "April 2024 - June 2024",
  //       description: "Meet and exceed client captioning targets on a daily and weekly basis",
  //       details: [
  //         "Meet and exceed client captioning targets on a daily and weekly basis, resulting in improved client satisfaction and increased project efficiency",
  //         "Documented and notified development team of technical errors, bugs, contributing to the timely resolution of issues",
  //         "Created a spreadsheet to track personal productivity, resulting in 50% increase in captions per day"
  //       ],
  //     },
  //     {
  //       title: "Software Engineering Virtual Experience",
  //       company: "Forage (J.P Morgan)",
  //       location: "",
  //       date: "December 2023 - January 2024",
  //       description: "Developed live graph generation functionality using JPMorgan's open-source library",
  //       details: [
  //         "Developed live graph generation functionality using JPMorgan's open-source library, Perspective, and gained exposure to financial data visualization and agile methodologies"
  //       ],
  //     },
  //     {
  //       title: "Software Engineer",
  //       company: "Freelance",
  //       location: "Atlanta, GA",
  //       date: "December 2023 - Present",
  //       description: "Develop and build dynamic UI to support multiple businesses",
  //       details: [
  //         "Develop and build dynamic UI to support multiple businesses in an Agile environment using web frameworks like React and Nextjs and mobile frameworks such as React Native and Expo Go",
  //         "Design, develop, and code web and mobile components for multiple clients, including debugging, diagnosing root causes, & identifying solutions",
  //         "Develop blockchain-based crypto games utilizing Solana, Web3.js, Rust and Anchor"
  //       ],
  //     }
  //   ],
  //   projects: [
  //     {
  //       name: "AI Travel & Vacation Planning Application",
  //       achievement: "Published App 50+ Users",
  //       description: "Led a team of developers, designers, and marketers to create an AI-powered platform for vacation planning",
  //       link: "cityswipe.app",
  //       technologies: ["Next.js", "React", "Vercel", "Supabase", "Gemini", "Framer Motion", "Pexels API"],
  //       date: "July 2024 - Present",
  //       details: [
  //         "Led a team of developers, designers, and marketers to create an AI-powered platform for vacation planning, leveraging machine learning for personalized recommendations",
  //         "Integrated natural language processing (NLP) to improve user interaction with travel suggestions based on preferences",
  //         "Impact: Garnered thousands of social media impressions, secured investment from the CEO of Lunchbox, and grew user engagement by 150%"
  //       ],
  //     },
  //     {
  //       name: "Job Tracker & Data Analysis Application",
  //       achievement: "Published App 10+ Users",
  //       description: "Developed a job application tracking tool that automated the data entry and analysis",
  //       link: "myjobkompass.com",
  //       technologies: ["Next.js", "TypeScript", "React", "Supabase", "Tailwind CSS", "Vercel", "Chart.js", "React Query", "Prisma", "PostgreSQL"],
  //       date: "January 2024 - April 2024",
  //       details: [
  //         "Developed a job application tracking tool that automated the data entry and analysis of job applications, reducing job search time by 50%",
  //         "Collaborated with users to refine features based on feedback, conducting iterative testing to improve UI and functionality",
  //         "I landed my first contract role in tech (Dataforce), and the Software engineering fellowship (Headstarter) role using this tool"
  //       ],
  //     },
  //     {
  //       name: "RAG AI Rate My Professor Chat Application",
  //       achievement: "Published App 5+ Users",
  //       description: "Designed and implemented an AI-powered web application for professor reviews using vector search and real-time data processing",
  //       link: "ratemyprofessor.vercel.app",
  //       technologies: ["Nextjs", "TypeScript", "React", "Vercel", "Pinecone", "OpenAI", "Langchain", "Framer Motion"],
  //       date: "August 2024",
  //       details: [
  //         "Designed a web app utilizing real-time data and vector search, delivering accurate and up-to-date responses",
  //         "Emphasized ML model fine-tuning to maintain high levels of data relevance"
  //       ],
  //     },
  //     {
  //       name: "Instant Video Caption Generator (Jelly Up!)",
  //       achievement: "2nd Place Hackathon Winner",
  //       description: "Built a backend AI system for video captioning using OpenAI Whisper",
  //       link: "jellyup.vercel.app",
  //       technologies: ["Nextjs", "TypeScript", "React", "Vercel", "Docker", "OpenCV", "OpenAI (Whisper)", "Supabase"],
  //       date: "August 2024",
  //       details: [
  //         "Built a backend AI system for video captioning, achieving high transcription accuracy using OpenAI Whisper",
  //         "Impact: Won 2nd place at the Headstarter Hiring Hackathon among hundreds of teams, demonstrating excellence in real-time caption generation for diverse media"
  //       ],
  //     },
  //     {
  //       name: "Voice Activated AI Travel Assistant (Globetrotter AI)",
  //       achievement: "Published App 20+ Users",
  //       description: "Developed an AI-powered voice assistant for personalized travel recommendations",
  //       link: "globetrotterai.vercel.app",
  //       technologies: ["Nextjs", "React", "Vercel", "Gemini", "Google TTS", "React Three Fiber", "Framer Motion"],
  //       date: "August 2024",
  //       details: [
  //         "Designed a conversational AI travel assistant using Flask, integrating multiple travel APIs for seamless itinerary planning",
  //         "Impact: Won 1st place at the Headstarter Hiring Hackathon, recognized for innovation and utility in travel assistance"
  //       ],
  //     }
  //   ],
  //   skills: {
  //     technical: ["Python", "React", "React Native", "SQL"],
  //     additional: ["UI/UX Design", "Leadership", "Teamwork", "Agile", "Artist", "Musician (Piano, Guitar)"]
  //   },
  //   additionalInfo: {
  //     interests: ["Mentoring", "Investing", "Crypto", "Basketball", "Gaming", "Traveling", "Teaching", "Machine Learning"],
  //     hobbies: ["Photography", "Music Production", "Rock Climbing", "Chess"],
  //     languages: ["English (Native)", "Spanish (Conversational)", "Mandarin (Basic)"],
  //     references: ["Available upon request"],
  //   },
  // });

  const [userFieldData, setUserFieldData] = useState<userFieldData>({
    personalInfo: {
      firstName: "",
      lastName: "",
      email: "",
      citizenship: "",
      phone: "",
      location: "",
      website: "",
      socials: []
    },
    education: [],
    experience: [],
    projects: [],
    skills: {
      technical: [],
      additional: []
    },
    additionalInfo: {
      interests: [],
      hobbies: [],
      languages: [],
      references: []
    }
  });

  const [currentThemeName, setCurrentThemeName] = useState<string>('Tech Bro');
  const [currentJobForResumeCreation, setCurrentJobForResumeCreation] = useState<any>(null);
  const [complexFieldIndex, setComplexFieldIndex] = useState<number>(0);
  const [complexFieldData, setComplexFieldData] = useState<any>(null);
  const [readyToSaveComplexFields, setReadyToSaveComplexFields] = useState<boolean>(false);
  const [customSymbol, setCustomSymbol] = useState<any>(null);

  const [currentResumeId, setCurrentResumeId] = useState<string | null>(null);

  const resumes = [{}]


  // STUB -------- CALLBACKS



  // STUB -------- USEEFFECTS

  useEffect(() => {
  }, [])

  const handleCreateNewComplexField = (template: string, category: string) => {
    console.log(`Creating new entry for theme "${template}" in category "${category}"...`);
  
    if (template === "Tech Bro") {
      let newEntry = {};
  
      if (category === "Projects") {
        newEntry = {
          name: "",
          description: "",
          technologies: [],
          date: "",
          details: [],
          achievement: "",
          link: "",
        };
        console.log("New Entry:", newEntry);
        // Use a callback function to ensure we're working with the latest state
        setUserFieldData((prev: any) => {
          // Make sure we're creating a new array reference
          const updatedProjects = Array.isArray(prev.projects) ? [...prev.projects, newEntry] : [newEntry];
          console.log("Updated Projects:", updatedProjects);
          // Return a new object reference to trigger re-render
          return { ...prev, projects: updatedProjects };
        });
      }
  
      if (category === "Education") {
        newEntry = {
          name: "",
          school: "",
          startDate: "",
          endDate: "",
          degree: "",
          field: "",
          date: "",
          details: [],
          description: "",
          technologies: [],
        };
        // Use a callback function to ensure we're working with the latest state
        setUserFieldData((prev: any) => {
          // Make sure we're creating a new array reference
          const updatedEducation = Array.isArray(prev.education) ? [...prev.education, newEntry] : [newEntry];
          console.log("Updated Education:", updatedEducation);
          // Return a new object reference to trigger re-render
          return { ...prev, education: updatedEducation };
        });
      }
  
      if (category === "Experience") {
        newEntry = {
          title: "",
          company: "",
          location: "",
          date: "",
          description: "",
          details: [],
        };
        // Use a callback function to ensure we're working with the latest state
        setUserFieldData((prev: any) => {
          // Make sure we're creating a new array reference
          const updatedExperience = Array.isArray(prev.experience) ? [...prev.experience, newEntry] : [newEntry];
          console.log("Updated Experience:", updatedExperience);
          // Return a new object reference to trigger re-render
          return { ...prev, experience: updatedExperience };
        });
      }
  
      if (Object.keys(newEntry).length === 0) {
        console.warn("Invalid category:", category);
      }
  
      return;
    }
  };

  const handleSaveComplexFields = (template: string, index: number, data: any, category: string) => {
    // Cleaner logging to confirm all values
    console.log("Saving complex fields:", { index, data, category });

    setUserFieldData((prev) => {
      if (category === "Projects") {
        const updatedProjects = [...prev.projects];
        if (index >= 0 && index < updatedProjects.length) {
          updatedProjects[index] = data; // Update existing project
        } else {
          updatedProjects.push(data); // Fallback for new project
        }
        console.log("Updated projects:", updatedProjects); // Debug
        return { ...prev, projects: updatedProjects };
      }

      if (category === "Education") {
        const updatedEducation = [...prev.education];
        if (index >= 0 && index < updatedEducation.length) {
          updatedEducation[index] = data; // Update existing education entry
        } else {
          updatedEducation.push(data); // Fallback for new education entry
        }
        console.log("Updated education:", updatedEducation); // Debug
        return { ...prev, education: updatedEducation };
      }

      if (category === "Experience") {
        const updatedExperience = [...prev.experience];
        if (index >= 0 && index < updatedExperience.length) {
          updatedExperience[index] = data; // Update existing experience entry
        } else {
          updatedExperience.push(data); // Fallback for new experience entry
        }
        console.log("Updated experience:", updatedExperience); // Debug
        return { ...prev, experience: updatedExperience };
      }

      // If category doesn’t match, return unchanged state
      console.warn("Unknown category:", category);
      return prev;

    });
    // if (template === "Tech Bro") {
    // }   

  };

  const handleDeleteComplexField = (template: string, index: number, category: string) => {
    console.log(`Deleting entry at index ${index} for theme "${template}" in category "${category}"...`);

    setUserFieldData((prev: any) => {
      if (category === "Projects") {
        const updatedProjects = [...prev.projects];
        updatedProjects.splice(index, 1);
        console.log("Updated projects:", updatedProjects);
        return {...prev, projects: updatedProjects };
      }

      if (category === "Education") {
        const updatedEducation = [...prev.education];
        updatedEducation.splice(index, 1);
        console.log("Updated education:", updatedEducation);
        return {...prev, education: updatedEducation };
      }
      if (category === "Experience") {
        const updatedExperience = [...prev.experience];
        updatedExperience.splice(index, 1);
        console.log("Updated experience:", updatedExperience);
        return {...prev, experience: updatedExperience };
      }
      // If category doesn’t match, return unchanged state
      console.warn("Unknown category:", category);
      return prev;
    });

    // if (template === "Tech Bro") {
    // }
  };

  const handleAddDetail = (category: string, index: number, newDetail: string) => {
    setUserFieldData((prev) => {
      if (category === "Projects") {
        const updatedProjects = [...prev.projects];
        updatedProjects[index].details = [...(updatedProjects[index].details || []), newDetail];
        return { ...prev, projects: updatedProjects };
      }
  
      if (category === "Education") {
        const updatedEducation = [...prev.education];
        updatedEducation[index].details = [...(updatedEducation[index].details || []), newDetail];
        return { ...prev, education: updatedEducation };
      }
  
      if (category === "Experience") {
        const updatedExperience = [...prev.experience];
        updatedExperience[index].details = [...(updatedExperience[index].details || []), newDetail];
        return { ...prev, experience: updatedExperience };
      }
  
      return prev;
    });
  };
  
  const handleRemoveDetail = (category: string, itemIndex: number, detailIndex: number) => {
    setUserFieldData((prev) => {
      if (category === "Projects") {
        const updatedProjects = [...prev.projects];
        updatedProjects[itemIndex].details = updatedProjects[itemIndex].details.filter((_, i) => i !== detailIndex);
        return { ...prev, projects: updatedProjects };
      }
  
      if (category === "Education") {
        const updatedEducation = [...prev.education];
        updatedEducation[itemIndex].details = updatedEducation[itemIndex].details.filter((_, i) => i !== detailIndex);
        return { ...prev, education: updatedEducation };
      }
  
      if (category === "Experience") {
        const updatedExperience = [...prev.experience];
        updatedExperience[itemIndex].details = updatedExperience[itemIndex].details.filter((_, i) => i !== detailIndex);
        return { ...prev, experience: updatedExperience };
      }
  
      return prev;
    });
  };

  const clearResumeDataDeepseek = (setUserFieldData: React.Dispatch<React.SetStateAction<userFieldData>>) => {
  setUserFieldData(prev => ({
      ...prev,
      education: [],
      experience: [],
      projects: [],
      skills: {
      technical: [],
      additional: []
      },
      additionalInfo: {
      interests: [],
      hobbies: [],
      languages: [],
      references: []
      }
  }));
  };

  const updateResumeWithAIDataDeepseek = (
    setUserFieldData: React.Dispatch<React.SetStateAction<userFieldData>>,
    aiData: Partial<userFieldData>
  ) => {
    setUserFieldData(prev => ({
      ...prev,
      education: aiData.education || prev.education,
      experience: aiData.experience || prev.experience,
      projects: aiData.projects || prev.projects,
      skills: aiData.skills || prev.skills,
      additionalInfo: aiData.additionalInfo || prev.additionalInfo
    }));
  };

  const value = {

    userFieldData,
    setUserFieldData,
    currentThemeName,
    setCurrentThemeName,
    currentJobForResumeCreation, 
    setCurrentJobForResumeCreation,

    complexFieldIndex,
    setComplexFieldIndex,
    complexFieldData,
    setComplexFieldData,
    readyToSaveComplexFields,
    setReadyToSaveComplexFields,

    handleCreateNewComplexField,
    handleSaveComplexFields,
    handleDeleteComplexField,

    customSymbol,
    setCustomSymbol,

    clearResumeDataDeepseek: () => clearResumeDataDeepseek(setUserFieldData),
    updateResumeWithAIDataDeepseek: (aiData: Partial<userFieldData>) => updateResumeWithAIDataDeepseek(setUserFieldData, aiData),

    handleAddDetail,
    handleRemoveDetail,

    currentResumeId,
    setCurrentResumeId,

    resumes,
    
  };

  return (
    <ResumeContext.Provider value={value}>
      {children}
    </ResumeContext.Provider>
  );
}

export default JobKompassResumeProvider;

export const useJobKompassResume = () => {
  const context = useContext(ResumeContext);
  if (!context) {
    throw new Error('useJobKompassResume must be used within a JobKompassResumeProvider');
  }
  return context;
};