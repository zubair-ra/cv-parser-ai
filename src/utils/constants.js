const REGEX_PATTERNS = {
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  PHONE: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  URL: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
  DATE: /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}\b/gi,
  LINKEDIN: /linkedin\.com\/in\/[a-zA-Z0-9\-]+/gi,
  GITHUB: /github\.com\/[a-zA-Z0-9\-]+/gi
};

const SECTION_HEADERS = {
  PERSONAL: /^(personal|contact|profile)(\s+information?)?$/i,
  EXPERIENCE: /^(experience|work|employment|career|professional)(\s+history)?$/i,
  EDUCATION: /^(education|academic|qualifications?)$/i,
  SKILLS: /^(skills|competencies|technical|abilities)$/i,
  CERTIFICATIONS: /^(certifications?|certificates?)$/i,
  PROJECTS: /^(projects?|portfolio)$/i,
  SUMMARY: /^(summary|objective|profile)$/i
};

const COMMON_SKILLS = {
  PROGRAMMING: [
    'JavaScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust', 'Swift',
    'TypeScript', 'Kotlin', 'Scala', 'R', 'MATLAB', 'Perl', 'Objective-C'
  ],
  FRAMEWORKS: [
    'React', 'Angular', 'Vue.js', 'Node.js', 'Express', 'Django', 'Flask', 'Spring',
    'Laravel', 'Rails', 'Next.js', 'Nuxt.js', 'Svelte', 'jQuery'
  ],
  DATABASES: [
    'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'SQLite', 'Oracle', 'SQL Server',
    'Cassandra', 'DynamoDB', 'Firebase', 'Elasticsearch'
  ],
  CLOUD: [
    'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Jenkins', 'Git',
    'CI/CD', 'DevOps', 'Terraform', 'Ansible'
  ],
  SOFT_SKILLS: [
    'Leadership', 'Communication', 'Problem Solving', 'Team Work', 'Project Management',
    'Critical Thinking', 'Adaptability', 'Time Management', 'Analytical Skills'
  ]
};

const DATE_FORMATS = [
  'YYYY-MM-DD',
  'MM/DD/YYYY',
  'DD/MM/YYYY',
  'YYYY',
  'MM/YYYY',
  'MMM YYYY',
  'MMMM YYYY'
];

module.exports = {
  REGEX_PATTERNS,
  SECTION_HEADERS,
  COMMON_SKILLS,
  DATE_FORMATS
};
