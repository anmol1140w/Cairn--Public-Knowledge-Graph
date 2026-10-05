import type { Mode } from "./types";
export interface ProfileField {
  key: string;
  label: string;
  kind?:
    | "tags"
    | "select"
    | "number"
    | "date"
    | "checkbox"
    | "range"
    | "textarea"
    | "skills";
  options?: string[];
  suggestions?: string[];
  hint?: string;
}
export const PROFILE_TITLES: Record<Mode, string> = {
  universe: "Your search preferences",
  jobs: "Your job preferences",
  scholar: "Your research preferences",
  news: "Your news preferences",
  patents: "Your patent search preferences",
};
export const PROFILE_FIELDS: Record<
  Mode,
  { main: ProfileField[]; more: ProfileField[] }
> = {
  jobs: {
    main: [
      {
        key: "roles",
        label: "Roles (up to 3)",
        kind: "tags",
        suggestions: [
          "Software engineer",
          "Data analyst",
          "Research assistant",
        ],
      },
      {
        key: "jobType",
        label: "Job type",
        kind: "select",
        options: [
          "Any",
          "Full-time",
          "Part-time",
          "Internship",
          "Research internship",
          "Contract",
        ],
      },
      { key: "experience", label: "Experience (years)", kind: "range" },
      {
        key: "qualification",
        label: "Qualification",
        suggestions: ["School", "Diploma", "Bachelor’s", "Master’s", "PhD"],
      },
      {
        key: "skills",
        label: "Skills",
        kind: "skills",
        suggestions: [
          "Python",
          "SQL",
          "JavaScript",
          "PyTorch",
          "Excel",
          "Communication",
        ],
      },
      {
        key: "locations",
        label: "Preferred locations",
        kind: "tags",
        suggestions: ["Remote", "London", "Bengaluru", "New York"],
      },
    ],
    more: [
      { key: "field", label: "Education field" },
      { key: "graduationYear", label: "Graduation year", kind: "number" },
      { key: "marks", label: "Marks / GPA (optional)" },
      {
        key: "relocation",
        label: "Open to relocation",
        kind: "select",
        options: ["Not specified", "Yes", "No"],
      },
      {
        key: "arrangement",
        label: "Work arrangement",
        kind: "select",
        options: ["Any", "On-site", "Hybrid", "Remote"],
      },
      { key: "salaryMin", label: "Minimum salary", kind: "number" },
      { key: "salaryMax", label: "Maximum salary", kind: "number" },
      {
        key: "currency",
        label: "Currency",
        kind: "select",
        options: ["USD", "INR", "EUR", "GBP"],
      },
      {
        key: "payPeriod",
        label: "Salary period",
        kind: "select",
        options: ["Year", "Month", "Hour"],
      },
      { key: "joiningDate", label: "Available from", kind: "date" },
      { key: "languages", label: "Languages", kind: "tags" },
      { key: "certifications", label: "Certifications", kind: "tags" },
      { key: "workAuthorization", label: "Work authorization (optional)" },
    ],
  },
  scholar: {
    main: [
      {
        key: "goal",
        label: "Research goal",
        kind: "select",
        options: [
          "Explore",
          "Understand a topic",
          "Literature review",
          "Find a research gap",
          "Choose a project",
        ],
      },
      {
        key: "level",
        label: "Education level",
        kind: "select",
        options: [
          "Not specified",
          "School",
          "Undergraduate",
          "Postgraduate",
          "Researcher",
        ],
      },
      {
        key: "field",
        label: "Research field",
        suggestions: ["Computer science", "Medicine", "Climate", "Economics"],
      },
      { key: "subfield", label: "Subfield" },
      {
        key: "paperType",
        label: "Paper type",
        kind: "select",
        options: ["Any", "Review", "Empirical", "Theoretical", "Preprint"],
      },
      {
        key: "openAccess",
        label: "Prefer open access",
        kind: "checkbox",
        hint: "Access is confirmed only when returned by the source.",
      },
    ],
    more: [
      { key: "yearFrom", label: "From year", kind: "number" },
      { key: "yearTo", label: "To year", kind: "number" },
      { key: "minCitations", label: "Minimum citations", kind: "number" },
      {
        key: "sort",
        label: "Sort papers",
        kind: "select",
        options: ["Relevance", "Newest", "Citations"],
      },
      {
        key: "readingLevel",
        label: "Reading level",
        kind: "select",
        options: ["Simple", "Technical"],
      },
      {
        key: "citationStyle",
        label: "Citation style",
        kind: "select",
        options: ["APA", "MLA", "IEEE", "BibTeX"],
      },
    ],
  },
  news: {
    main: [
      {
        key: "goal",
        label: "News goal",
        kind: "select",
        options: [
          "Understand an event",
          "Check a claim",
          "Compare sources",
          "Follow a topic",
        ],
      },
      { key: "claim", label: "Claim to check (optional)", kind: "textarea" },
      {
        key: "topic",
        label: "Topic",
        suggestions: ["Technology", "Climate", "Health", "Policy"],
      },
      { key: "region", label: "Region" },
      {
        key: "timeWindow",
        label: "Time window",
        kind: "select",
        options: ["Any time", "Past day", "Past week", "Past month", "Custom"],
      },
      {
        key: "sourceTypes",
        label: "Source types",
        kind: "tags",
        suggestions: [
          "Primary sources",
          "Company announcements",
          "Wire services",
          "Newspapers",
        ],
      },
    ],
    more: [
      { key: "dateFrom", label: "Start date", kind: "date" },
      { key: "dateTo", label: "End date", kind: "date" },
      {
        key: "language",
        label: "Language",
        kind: "select",
        options: ["English", "Hindi", "Spanish", "French", "German"],
      },
      {
        key: "readingLevel",
        label: "Reading level",
        kind: "select",
        options: ["Simple", "Technical"],
      },
    ],
  },
  patents: {
    main: [
      { key: "idea", label: "Describe your idea", kind: "textarea" },
      {
        key: "purpose",
        label: "Search purpose",
        kind: "select",
        options: [
          "Explore related inventions",
          "Find prior work",
          "Compare approaches",
          "Understand a patent",
        ],
      },
      {
        key: "jurisdictions",
        label: "Jurisdictions",
        kind: "tags",
        suggestions: ["US", "EP", "WO", "IN", "JP"],
      },
      { key: "keywords", label: "Include keywords", kind: "tags" },
      {
        key: "status",
        label: "Status preference",
        kind: "select",
        options: ["Any", "Granted", "Application", "Expired", "Active"],
        hint: "Applied only to status explicitly returned by the source.",
      },
    ],
    more: [
      { key: "dateFrom", label: "Earliest date", kind: "date" },
      { key: "dateTo", label: "Latest date", kind: "date" },
      { key: "includeCompanies", label: "Include companies", kind: "tags" },
      { key: "excludeCompanies", label: "Exclude companies", kind: "tags" },
      { key: "inventors", label: "Inventors", kind: "tags" },
      {
        key: "userRole",
        label: "Your role",
        kind: "select",
        options: [
          "Not specified",
          "Student",
          "Researcher",
          "Inventor",
          "Business",
          "Patent professional",
        ],
      },
    ],
  },
  universe: {
    main: [
      { key: "goal", label: "What would you like to learn?" },
      {
        key: "interests",
        label: "Interests",
        kind: "tags",
        suggestions: ["Research", "Careers", "News", "Inventions"],
      },
      { key: "region", label: "Region" },
      {
        key: "readingLevel",
        label: "Reading level",
        kind: "select",
        options: ["Simple", "Technical"],
      },
    ],
    more: [],
  },
};
