export interface PersonalInfo {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  summary?: string;
}

export interface Experience {
  company: string;
  position: string;
  startDate: string;
  endDate?: string;
  description: string;
  achievements?: string[];
  technologies?: string[];
  location?: string;
}

export interface Education {
  school: string;
  degree: string;
  graduationDate: string;
  gpa?: string;
  relevantCoursework?: string[];
  location?: string;
}

export interface Certification {
  name: string;
  issuer: string;
  dateObtained: string;
  expiryDate?: string;
  credentialId?: string;
}

export interface Project {
  name: string;
  description: string;
  technologies: string[];
  githubUrl?: string;
  liveUrl?: string;
  startDate?: string;
  endDate?: string;
}

export interface Language {
  language: string;
  proficiency: string; // "Native", "Fluent", "Intermediate", "Basic"
}

export interface VolunteerWork {
  organization: string;
  role: string;
  startDate: string;
  endDate?: string;
  description: string;
}

export interface ResumeContent {
  personalInfo: PersonalInfo;
  experience: Experience[];
  education: Education[];
  skills: string[];
  certifications?: Certification[];
  projects?: Project[];
  languages?: Language[];
  volunteerWork?: VolunteerWork[];
}

export interface Resume {
  _id: string;
  userId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  isActive?: boolean;
  content: ResumeContent;
}

export interface CoverLetterContent {
  template: string;
  company?: string;
  position?: string;
  customizations?: {
    keyPoints: string[];
    tone: string;
  };
}

export interface CoverLetter {
  _id: string;
  userId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  content: CoverLetterContent;
}

export interface EmailTemplateContent {
  template: string;
  variables: string[];
  defaultValues?: Record<string, string>;
}

export interface EmailTemplate {
  _id: string;
  userId: string;
  name: string;
  type: string;
  createdAt: number;
  updatedAt: number;
  content: EmailTemplateContent;
} 