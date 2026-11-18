# JobKompass Resume Information Architecture Guide

This guide documents the patterns, rules, and structures for accurately capturing and processing resume information in JobKompass. Use this guide to understand how resume data should be structured, processed, and transformed regardless of the visual template or output format.

## Table of Contents

1. [Core Data Structure](#core-data-structure)
2. [Personal Information Patterns](#personal-information-patterns)
3. [Experience Entry Patterns](#experience-entry-patterns)
4. [Education Entry Patterns](#education-entry-patterns)
5. [Projects Entry Patterns](#projects-entry-patterns)
6. [Skills Structure Patterns](#skills-structure-patterns)
7. [URL Processing Rules](#url-processing-rules)
8. [Text Processing Rules](#text-processing-rules)
9. [Date Formatting Patterns](#date-formatting-patterns)
10. [Array Handling Patterns](#array-handling-patterns)
11. [Optional Field Handling](#optional-field-handling)
12. [Name Handling Patterns](#name-handling-patterns)

---

## Core Data Structure

### Primary Resume Content Type

```typescript
type ResumeContent = {
    personalInfo: {
        firstName: string;
        lastName: string;
        email: string;
        location?: string;
        linkedin?: string;
        github?: string;
        portfolio?: string;
        citizenship?: string;
    };
    experience: Array<{
        company: string;
        title: string;
        date: string;
        details?: string[];
        location?: string;
    }>;
    education: Array<{
        name: string;
        degree: string;
        field?: string;
        startDate?: string;
        endDate: string;
        location?: string;
        details?: string[];
    }>;
    skills: {
        technical: string[];
        additional?: string[];
    };
    projects?: Array<{
        name: string;
        description: string;
        technologies: string[];
        details?: string[];
        date?: string;
    }>;
    additionalInfo?: {
        languages?: Array<{
            language: string;
            proficiency: string;
        }>;
        references?: string;
    };
};
```

**Key Principles:**
- All arrays default to empty arrays `[]` if not provided
- Optional fields use `?` and can be `null`, `undefined`, or omitted
- Strings are never `null` - use empty string `""` for missing values
- Arrays are always arrays, never `null` - use empty array for no items

---

## Personal Information Patterns

### Required Fields
- `firstName`: string (required)
- `lastName`: string (required)
- `email`: string (required, must be valid email format)

### Optional Fields
- `location`: string | null | undefined
  - Format: "City, State" or "City, State, Country"
  - Example: "San Francisco, CA" or "Atlanta, GA"
  
- `citizenship`: string | null | undefined
  - Work authorization status
  - Example: "US Citizen" or "Authorized to work in US"
  
- `linkedin`: string | null | undefined
  - **CRITICAL**: See [URL Processing Rules](#url-processing-rules) for handling
  
- `github`: string | null | undefined
  - **CRITICAL**: See [URL Processing Rules](#url-processing-rules) for handling
  
- `portfolio`: string | null | undefined
  - Portfolio website URL

### Name Handling Pattern

**Rule**: Always prefer `firstName` and `lastName` over a single `name` field.

**Fallback Pattern**:
```typescript
// If firstName/lastName not provided, split name field
if (!firstName && !lastName && name) {
    const nameParts = name.split(' ');
    firstName = nameParts[0] || '';
    lastName = nameParts.slice(1).join(' ') || '';
}
```

**Full Name Construction**:
```typescript
const fullName = `${firstName} ${lastName}`.trim();
```

---

## Experience Entry Patterns

### Structure
```typescript
{
    company: string;        // Required: Company name
    title: string;          // Required: Job title/position
    date: string;           // Required: Date range string
    location?: string;      // Optional: Job location
    details?: string[];     // Optional: Array of bullet points
}
```

### Date Format Pattern

**Input Format**: Single string containing date range
- Examples: `"Jan 2020 - Present"`, `"Jun 2018 - Dec 2019"`, `"2020 - 2022"`
- Always use human-readable format, not ISO dates
- Use "Present" (capitalized) for current positions

**Processing Rule**: Store as single string, not separate start/end dates for this format.

### Details Array Pattern

- Each item in `details` is a bullet point string
- Bullet points should be achievement-focused, not just responsibilities
- Use past tense for completed roles, present tense for current roles
- Each bullet should be a complete sentence or phrase

**Example**:
```typescript
details: [
    "Increased revenue by 30% through strategic partnerships",
    "Led team of 5 engineers to deliver product on time",
    "Implemented CI/CD pipeline reducing deployment time by 50%"
]
```

---

## Education Entry Patterns

### Structure
```typescript
{
    name: string;           // Required: School/University name
    degree: string;         // Required: Degree type and field
    field?: string;         // Optional: Field of study (if not in degree)
    startDate?: string;     // Optional: Start date
    endDate: string;        // Required: Graduation date or "Present"
    location?: string;      // Optional: School location
    details?: string[];     // Optional: GPA, honors, coursework, etc.
}
```

### Degree Format Pattern

**Combined Format**: If `field` is provided, combine with degree
```typescript
const degreeText = `${degree}${field ? ` in ${field}` : ''}`;
// Examples:
// "Bachelor of Science in Computer Science"
// "Master of Business Administration"
// "Bachelor of Science" (if no field)
```

### Date Handling Pattern

**Format**: 
- `startDate` and `endDate` are separate strings
- Format: "Jan 2020" or "2020" or "Present"
- If `startDate` exists: `"${startDate} -- ${endDate}"`
- If no `startDate`: Just `endDate`

**Example**:
```typescript
const dates = startDate 
    ? `${startDate} -- ${endDate}` 
    : endDate;
// Results: "Jan 2018 -- May 2022" or "May 2022"
```

### Details Array Pattern

Education `details` typically contains:
- GPA: `"GPA: 3.8/4.0"`
- Honors: `"Summa Cum Laude"`, `"Dean's List"`
- Relevant coursework: `"Relevant Coursework: Data Structures, Algorithms"`
- Academic achievements: `"Published research paper in..."`

---

## Projects Entry Patterns

### Structure
```typescript
{
    name: string;           // Required: Project name
    description: string;     // Required: Project description (first bullet)
    technologies?: string[]; // Optional: Technologies used
    details?: string[];     // Optional: Additional project details
    date?: string;          // Optional: Completion date
}
```

### Project Name Format Pattern

**With Technologies**:
```typescript
const projectName = technologies && technologies.length
    ? `${name} | ${technologies.join(', ')}`
    : name;
// Example: "E-Commerce Platform | React, Node.js, PostgreSQL"
```

**Without Technologies**:
```typescript
// Just the project name
// Example: "Personal Portfolio Website"
```

### Details Array Pattern

- First item is always the `description` (main project description)
- Additional items in `details` are supporting bullet points
- Each detail should highlight specific achievements or features

**Example**:
```typescript
{
    name: "Task Management App",
    description: "Built a full-stack task management application",
    technologies: ["React", "Node.js", "MongoDB"],
    details: [
        "Implemented real-time collaboration features",
        "Achieved 99.9% uptime with optimized database queries",
        "Deployed to AWS with CI/CD pipeline"
    ]
}
```

---

## Skills Structure Patterns

### Structure
```typescript
{
    technical: string[];    // Required: Technical skills array
    additional?: string[];  // Optional: Additional/non-technical skills
}
```

### Skills Array Pattern

- `technical`: Also called "Languages" in some templates
  - Programming languages, frameworks, tools
  - Example: `["JavaScript", "Python", "React", "Node.js", "PostgreSQL"]`
  
- `additional`: Also called "Additional Skills" in some templates
  - Soft skills, methodologies, other competencies
  - Example: `["Agile", "Scrum", "Project Management", "Public Speaking"]`

### Display Pattern

**Technical Skills**:
```typescript
// Format: "Languages: Skill1, Skill2, Skill3"
`Languages: ${technical.join(', ')}`
```

**Additional Skills**:
```typescript
// Format: "Additional Skills: Skill1, Skill2, Skill3"
`Additional Skills: ${additional.join(', ')}`
```

---

## URL Processing Rules

### Critical Rule: Always Extract Handle, Never Duplicate Domain

URLs can be stored in multiple formats. Always normalize to extract just the handle/username before adding domain back.

### LinkedIn URL Processing

**Input Formats Accepted**:
- Full URL: `https://linkedin.com/in/johndoe`
- Full URL with www: `https://www.linkedin.com/in/johndoe`
- Partial URL: `linkedin.com/in/johndoe`
- Just handle: `johndoe`

**Processing Pattern**:
```typescript
let linkedinHandle = linkedin
    .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '') // Remove full URL
    .replace(/^linkedin\.com\/in\//, '')                    // Remove partial URL
    .replace(/\/$/, '');                                    // Remove trailing slash

// Result: Just the handle (e.g., "johndoe")

// Then construct display URL:
const displayUrl = `linkedin.com/in/${linkedinHandle}`;
const fullUrl = `https://linkedin.com/in/${linkedinHandle}`;
```

**Output Format**: Always display as `linkedin.com/in/handle` (no label prefix)

### GitHub URL Processing

**Input Formats Accepted**:
- Full URL: `https://github.com/johndoe`
- Full URL with www: `https://www.github.com/johndoe`
- Partial URL: `github.com/johndoe`
- Just handle: `johndoe`

**Processing Pattern**:
```typescript
let githubHandle = github
    .replace(/^https?:\/\/(www\.)?github\.com\//, '') // Remove full URL
    .replace(/^github\.com\//, '')                     // Remove partial URL
    .replace(/\/$/, '');                               // Remove trailing slash

// Result: Just the handle (e.g., "johndoe")

// Then construct display URL:
const displayUrl = `github.com/${githubHandle}`;
const fullUrl = `https://github.com/${githubHandle}`;
```

**Output Format**: Always display as `github.com/handle` (no label prefix)

### Portfolio URL Processing

**Input Formats Accepted**:
- Full URL: `https://johndoe.com`
- Full URL with protocol: `http://johndoe.com`
- Domain only: `johndoe.com`
- Subdomain: `portfolio.johndoe.com`

**Processing Pattern**:
```typescript
// Portfolio URLs are stored as-is, no extraction needed
// Just ensure protocol is added if missing for links
const portfolioUrl = portfolio.startsWith('http') 
    ? portfolio 
    : `https://${portfolio}`;
```

**Output Format**: Display the domain as-is (e.g., `johndoe.com`)

### URL Display Rule

**NEVER** include the label in the displayed URL. The URL itself should be self-explanatory.

**Wrong**:
```
LinkedIn: linkedin.com/in/johndoe  // Label + URL = duplication
```

**Correct**:
```
linkedin.com/in/johndoe  // Just the URL
```

---

## Text Processing Rules

### LaTeX Escaping Pattern

All text that will be rendered in LaTeX must be escaped to prevent LaTeX syntax errors.

**Escape Function**:
```typescript
function escapeLatex(text: string | null | undefined): string {
    if (!text) return '';
    return text
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/&/g, '\\&')
        .replace(/%/g, '\\%')
        .replace(/\$/g, '\\$')
        .replace(/#/g, '\\#')
        .replace(/_/g, '\\_')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}');
}
```

**Characters That Must Be Escaped**:
- `\` → `\textbackslash{}`
- `&` → `\&`
- `%` → `\%`
- `$` → `\$`
- `#` → `\#`
- `_` → `\_`
- `{` → `\{`
- `}` → `\}`
- `~` → `\textasciitilde{}`
- `^` → `\textasciicircum{}`

**Rule**: Escape ALL user-provided text before inserting into LaTeX templates.

### Null/Undefined Handling Pattern

**Always use empty string for missing text**:
```typescript
const text = value || '';
// NOT: const text = value ?? null;
```

**For optional fields in templates**:
```typescript
// Use empty string, not null
location: exp.location || ''
// Template will handle empty strings gracefully
```

---

## Date Formatting Patterns

### Experience Date Format

**Single String Format**:
- Input: `"Jan 2020 - Present"` or `"Jun 2018 - Dec 2019"`
- Store as single string in `date` field
- Format: `"Start -- End"` or `"Start - End"` (both acceptable)
- Use "Present" (capitalized) for current positions

**Examples**:
- `"Jan 2020 - Present"`
- `"Jun 2018 - Dec 2019"`
- `"2020 - 2022"`
- `"Summer 2019"`

### Education Date Format

**Separate Start/End Dates**:
- `startDate`: Optional, format `"Jan 2020"` or `"2020"`
- `endDate`: Required, format `"May 2022"` or `"Present"`

**Combined Display**:
```typescript
// If startDate exists:
const dates = `${startDate} -- ${endDate}`;
// Result: "Jan 2018 -- May 2022"

// If no startDate:
const dates = endDate;
// Result: "May 2022"
```

**Date Separator**: Use `--` (double dash) for date ranges in LaTeX output.

### Project Date Format

**Optional Single String**:
- Format: `"Jan 2020"` or `"2020"` or `"Completed 2020"`
- Can be omitted entirely
- Stored in `date` field as string

---

## Array Handling Patterns

### Empty Array Defaults

**Rule**: Always default to empty array, never `null` or `undefined`.

```typescript
// Correct
experience: experience || []
details: details || []

// Wrong
experience: experience ?? null
details: details ?? undefined
```

### Array Processing Pattern

**Always check if array exists and has length**:
```typescript
// Pattern for processing arrays
if (Array.isArray(items) && items.length > 0) {
    // Process items
    items.map(item => processItem(item))
} else {
    // Return empty/placeholder
    return '';
}
```

### Array Mapping Pattern

**For generating formatted output**:
```typescript
// Map array to formatted strings
const formattedItems = items
    .map(item => formatItem(item))
    .join('\n'); // Join with newlines for LaTeX, or appropriate separator
```

### Details Array Pattern

**Structure**: Array of strings, each representing a bullet point or detail item.

**Processing**:
```typescript
// Convert details array to formatted list
const detailsList = details && details.length
    ? details.map(detail => `\\resumeItem{${escapeLatex(detail)}}`).join('\n')
    : '';

// Wrap in list structure
const fullList = detailsList 
    ? `\\resumeItemListStart\n${detailsList}\n\\resumeItemListEnd`
    : '';
```

---

## Optional Field Handling

### Nullable Field Pattern

**Type Definition**:
```typescript
field?: string | null | undefined;
```

**Processing Rule**: Treat `null`, `undefined`, and empty string `""` as "not provided".

**Safe Access Pattern**:
```typescript
// Always provide fallback
const value = field || '';
const location = exp.location || '';
const field = edu.field || null; // If you need to preserve null vs empty
```

### Conditional Rendering Pattern

**Check before including**:
```typescript
// Only include if value exists
if (location) {
    parts.push(location);
}

// Or use filter
const parts = [
    email,
    location || null,
    linkedin || null
].filter(Boolean); // Removes null/undefined/empty
```

### Optional Array Fields

**Pattern**: Optional arrays should default to empty array if not provided.

```typescript
// Correct
details: details || []
technologies: technologies || []

// Access pattern
if (details && details.length > 0) {
    // Process details
}
```

---

## Name Handling Patterns

### Primary Pattern: firstName + lastName

**Preferred Structure**:
```typescript
{
    firstName: string;
    lastName: string;
}
```

### Fallback Pattern: Single name field

**If only `name` is provided**:
```typescript
// Split name into firstName and lastName
if (!firstName && !lastName && name) {
    const nameParts = name.trim().split(/\s+/);
    firstName = nameParts[0] || '';
    lastName = nameParts.slice(1).join(' ') || '';
}
```

**Edge Cases**:
- Single word name → `firstName = name`, `lastName = ""`
- Multiple words → First word = firstName, rest = lastName
- Empty name → `firstName = ""`, `lastName = ""`

### Full Name Construction

**Pattern**:
```typescript
const fullName = `${firstName} ${lastName}`.trim();
// Handles empty strings gracefully
// Result: "John Doe" or "John" (if no lastName)
```

---

## Field Mapping Patterns

### Experience Field Mapping

**Input → Internal Structure**:
```typescript
// Input might have:
{
    position: string;  // Maps to title
    startDate: string;
    endDate: string;
}

// Internal structure uses:
{
    title: string;
    date: string;  // Combined "startDate - endDate"
}
```

**Mapping Rule**: Combine `startDate` and `endDate` into single `date` string for experience entries.

### Education Field Mapping

**Input → Internal Structure**:
```typescript
// Input might have:
{
    school: string;  // Maps to name
    graduationDate: string;
}

// Internal structure uses:
{
    name: string;
    endDate: string;  // graduationDate
    startDate?: string;  // Optional
}
```

**Mapping Rule**: Keep start and end dates separate for education entries.

---

## Data Validation Patterns

### Required Field Validation

**Personal Info**:
- `firstName`: Required, non-empty string
- `lastName`: Required, non-empty string
- `email`: Required, valid email format

**Experience**:
- `company`: Required, non-empty string
- `title`: Required, non-empty string
- `date`: Required, non-empty string

**Education**:
- `name`: Required, non-empty string (school name)
- `degree`: Required, non-empty string
- `endDate`: Required, non-empty string or "Present"

### Array Validation

**Minimum Requirements**:
- `experience`: At least one entry recommended (not strictly required)
- `education`: At least one entry recommended (not strictly required)
- `skills.technical`: At least one skill recommended

**Empty Array Handling**:
- Empty arrays are valid
- Display placeholder text when arrays are empty
- Example: `"% No experience entries"` or `"% No education entries"`

---

## Data Transformation Patterns

### From User Input to Structured Data

**Pattern**: Normalize and validate input before storing.

```typescript
// Normalize experience entry
const normalizedExperience = {
    company: (input.company || '').trim(),
    title: (input.title || '').trim(),
    date: (input.date || '').trim(),
    location: (input.location || '').trim() || undefined,
    details: Array.isArray(input.details) 
        ? input.details.map(d => d.trim()).filter(Boolean)
        : []
};
```

### From Structured Data to Display

**Pattern**: Transform structured data to template-specific format.

```typescript
// Transform experience for LaTeX
const latexExperience = experience.map(exp => ({
    title: escapeLatex(exp.title),
    date: escapeLatex(exp.date),
    company: escapeLatex(exp.company),
    location: escapeLatex(exp.location || ''),
    details: exp.details.map(d => escapeLatex(d))
}));
```

---

## Common Pitfalls to Avoid

### 1. URL Duplication
❌ **Wrong**: Adding domain when URL already contains it
```typescript
// If stored as "linkedin.com/in/johndoe"
linkedin.com/in/linkedin.com/in/johndoe  // WRONG
```

✅ **Correct**: Always extract handle first
```typescript
// Extract handle, then add domain
const handle = url.replace(/^linkedin\.com\/in\//, '');
linkedin.com/in/johndoe  // CORRECT
```

### 2. Label Prefixes in URLs
❌ **Wrong**: Including label in URL display
```typescript
"LinkedIn: linkedin.com/in/johndoe"
```

✅ **Correct**: Just the URL
```typescript
"linkedin.com/in/johndoe"
```

### 3. Null vs Empty String
❌ **Wrong**: Using null for missing strings
```typescript
location: location || null
```

✅ **Correct**: Use empty string
```typescript
location: location || ''
```

### 4. Array Nullability
❌ **Wrong**: Allowing arrays to be null
```typescript
details: details ?? null
```

✅ **Correct**: Default to empty array
```typescript
details: details || []
```

### 5. Missing LaTeX Escaping
❌ **Wrong**: Inserting unescaped text
```typescript
`\\resumeItem{${detail}}`  // WRONG if detail contains &, %, etc.
```

✅ **Correct**: Always escape
```typescript
`\\resumeItem{${escapeLatex(detail)}}`  // CORRECT
```

---

## Summary: Core Principles

1. **URLs**: Always extract handle, never duplicate domain
2. **Text**: Always escape for LaTeX, use empty string for missing values
3. **Arrays**: Always default to empty array, never null
4. **Dates**: Use human-readable format, combine for experience, separate for education
5. **Names**: Prefer firstName/lastName, fallback to splitting name field
6. **Optional Fields**: Use `?` in types, provide fallbacks in processing
7. **Validation**: Check for existence and length before processing arrays
8. **Display**: Never include labels in URLs, let the URL be self-explanatory

---

## Quick Reference: Field Requirements

### Personal Info
- ✅ Required: `firstName`, `lastName`, `email`
- ⚪ Optional: `location`, `citizenship`, `linkedin`, `github`, `portfolio`

### Experience
- ✅ Required: `company`, `title`, `date`
- ⚪ Optional: `location`, `details[]`

### Education
- ✅ Required: `name`, `degree`, `endDate`
- ⚪ Optional: `field`, `startDate`, `location`, `details[]`

### Projects
- ✅ Required: `name`, `description`
- ⚪ Optional: `technologies[]`, `details[]`, `date`

### Skills
- ✅ Required: `technical[]`
- ⚪ Optional: `additional[]`

---

This guide provides the information architecture patterns. The visual template and styling are separate concerns that can be applied to this structured data.

