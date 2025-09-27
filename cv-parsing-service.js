const CVParser = require("cv-parser-ai-tb");
const ResumeParser = require("../../utils/resumeParser");

/**
 * 🚀 STANDALONE CV PARSING SERVICE
 * Separated from application submission for reusable functionality
 */

/**
 * Determine parsing level based on job requirements and priority
 */
const determineParsingLevel = (job, applicationData = {}) => {
  const jobTitle = (job.title || "").toLowerCase();
  const jobType = (job.jobType || "").toLowerCase();
  const salary = job.salary || 0;

  // High-priority positions require detailed parsing
  if (
    jobTitle.includes('senior') ||
    jobTitle.includes('lead') ||
    jobTitle.includes('manager') ||
    jobTitle.includes('director') ||
    jobTitle.includes('head') ||
    jobTitle.includes('principal') ||
    jobTitle.includes('architect') ||
    salary > 100000
  ) {
    return 'high';
  }

  // Technical roles that need skill extraction
  if (
    jobTitle.includes('developer') ||
    jobTitle.includes('engineer') ||
    jobTitle.includes('programmer') ||
    jobTitle.includes('analyst') ||
    jobTitle.includes('specialist') ||
    jobType.includes('technical')
  ) {
    return 'moderate';
  }

  // Entry level or simple roles
  if (
    jobTitle.includes('junior') ||
    jobTitle.includes('intern') ||
    jobTitle.includes('entry') ||
    jobTitle.includes('assistant') ||
    jobTitle.includes('trainee') ||
    salary < 40000
  ) {
    return 'low';
  }

  // C-level or very senior positions
  if (
    jobTitle.includes('ceo') ||
    jobTitle.includes('cto') ||
    jobTitle.includes('cfo') ||
    jobTitle.includes('chief') ||
    jobTitle.includes('president') ||
    jobTitle.includes('vice president') ||
    salary > 200000
  ) {
    return 'ultra';
  }

  // Default for most positions
  return 'moderate';
};

/**
 * Get parsing level configuration and cost information
 */
const getParsingLevelInfo = (level) => {
  const levels = {
    'low': {
      description: 'Basic info extraction (name, email, phone)',
      estimatedTokens: 200,
      speed: 'Fastest',
      costMultiplier: 1.0
    },
    'moderate': {
      description: 'Balanced extraction (personal, summary, experience, education, skills)',
      estimatedTokens: 500,
      speed: 'Fast',
      costMultiplier: 2.5
    },
    'high': {
      description: 'Detailed extraction with comprehensive data including summary',
      estimatedTokens: 1000,
      speed: 'Medium',
      costMultiplier: 5.0
    },
    'ultra': {
      description: 'Complete extraction with full details, summary, and analysis',
      estimatedTokens: 2000,
      speed: 'Thorough',
      costMultiplier: 10.0
    }
  };

  return levels[level] || levels['moderate'];
};

/**
 * Create CV Parser instance with dynamic configuration
 */
const createCVParser = (parsingLevel = 'moderate') => {
  return new CVParser({
    apiKey: process.env.CV_API_KEY,
    provider: process.env.CV_PROVIDER,
    parsingLevel: parsingLevel,
    includeMetadata: true,
    normalizeData: true,
    confidenceThreshold: 0.6,
  });
};

/**
 * 🚀 MAIN CV PARSING FUNCTION - Standalone
 * Parse CV with dynamic parsing level and fallback options
 */
const parseCV = async (resumePath, options = {}) => {
  const {
    parsingLevel = 'moderate',
    job = null,
    fallbackToManual = true,
    includeAnalytics = true
  } = options;

  console.log(`🎯 Starting CV parsing with level: ${parsingLevel}`);

  let parseResult = {};
  let parseSuccess = false;
  let parsingMethod = "none";
  let actualTokensUsed = 0;
  let confidence = 0;

  try {
    // Try AI parser first with selected parsing level
    console.log(`CV Parser AI: Starting with ${parsingLevel} level...`);

    const dynamicCVParser = createCVParser(parsingLevel);
    parseResult = await dynamicCVParser.parse(resumePath);

    // Get actual token usage information
    const tokenInfo = dynamicCVParser.aiProcessor?.getTokenInfo();
    actualTokensUsed = tokenInfo?.estimatedTokens || 0;
    confidence = parseResult.metadata?.parseConfidence || 0;

    console.log(`CV Parser AI successful:`, {
      parsingLevel,
      confidence,
      provider: parseResult.metadata?.provider,
      tokensUsed: actualTokensUsed
    });

    parseSuccess = true;
    parsingMethod = "ai";

  } catch (aiError) {
    console.warn(`CV Parser AI failed with ${parsingLevel} level:`, aiError.message);

    if (fallbackToManual) {
      try {
        console.log("Starting manual resume parsing fallback...");

        const manualResult = await ResumeParser.parseResume(resumePath);
        console.log("Manual parser successful");

        parseResult = transformManualToAIFormat(manualResult);
        parseSuccess = true;
        parsingMethod = "manual";
        actualTokensUsed = getParsingLevelInfo('moderate').estimatedTokens;
        confidence = 0.7; // Default confidence for manual parsing

      } catch (manualError) {
        console.error("Manual parser also failed:", manualError.message);
        parseResult = getEmptyParseResult();
        parseSuccess = false;
        parsingMethod = "failed";
        actualTokensUsed = 0;
        confidence = 0;
      }
    } else {
      parseResult = getEmptyParseResult();
      parseSuccess = false;
      parsingMethod = "failed";
      actualTokensUsed = 0;
      confidence = 0;
    }
  }

  // Build comprehensive result
  const result = {
    success: parseSuccess,
    method: parsingMethod,
    parsingLevel,
    confidence,
    tokensUsed: actualTokensUsed,
    data: parseResult,

    // Extracted summary for quick access
    extracted: {
      personal: extractPersonalInfo(parseResult),
      experience: extractExperience(parseResult),
      education: extractEducation(parseResult),
      skills: extractSkills(parseResult),
      summary: parseResult.summary || parseResult.objective || null,
      totalExperience: calculateTotalExperienceYears(parseResult.experience || [])
    },

    // Analytics and metadata
    analytics: includeAnalytics ? {
      parsingLevelInfo: getParsingLevelInfo(parsingLevel),
      estimatedCost: (actualTokensUsed * 0.0005) / 1000,
      efficiency: parsingMethod === 'ai' ? 'optimal' : parsingMethod === 'manual' ? 'fallback' : 'failed',
      processingTime: new Date().toISOString(),
      jobContext: job ? {
        title: job.title,
        type: job.jobType,
        salary: job.salary,
        parsingLevelReason: `Auto-selected ${parsingLevel} level for ${job.title}`
      } : null
    } : null,

    // Raw metadata
    metadata: {
      parseDate: new Date().toISOString(),
      provider: parseResult.metadata?.provider || parsingMethod,
      keywords: parseResult.metadata?.keywords || [],
      originalParsingLevel: parsingLevel,
      fallbackUsed: parsingMethod === 'manual'
    }
  };

  console.log(`✅ CV parsing completed: ${parseSuccess ? 'Success' : 'Failed'} (${parsingMethod}, ${actualTokensUsed} tokens)`);

  return result;
};

/**
 * 🚀 BATCH CV PARSING - Parse multiple CVs with different levels
 */
const parseCVBatch = async (cvFiles, options = {}) => {
  const {
    defaultParsingLevel = 'moderate',
    maxConcurrent = 3,
    fallbackToManual = true
  } = options;

  console.log(`🚀 Starting batch CV parsing: ${cvFiles.length} files`);

  const results = [];
  const chunks = [];

  // Split into chunks for concurrent processing
  for (let i = 0; i < cvFiles.length; i += maxConcurrent) {
    chunks.push(cvFiles.slice(i, i + maxConcurrent));
  }

  for (const chunk of chunks) {
    const chunkPromises = chunk.map(async (cvFile) => {
      const parsingLevel = cvFile.parsingLevel || defaultParsingLevel;

      try {
        const result = await parseCV(cvFile.path, {
          parsingLevel,
          job: cvFile.job,
          fallbackToManual,
          includeAnalytics: true
        });

        return {
          file: cvFile.path,
          ...result
        };
      } catch (error) {
        return {
          file: cvFile.path,
          success: false,
          error: error.message,
          method: 'error',
          parsingLevel,
          tokensUsed: 0
        };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  // Calculate batch analytics
  const batchAnalytics = {
    totalFiles: cvFiles.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    totalTokens: results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0),
    avgTokensPerFile: results.length > 0 ? Math.round(results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0) / results.length) : 0,
    totalEstimatedCost: results.reduce((sum, r) => sum + ((r.tokensUsed || 0) * 0.0005) / 1000, 0),
    parsingLevelDistribution: {}
  };

  // Count parsing level usage
  results.forEach(r => {
    const level = r.parsingLevel || 'unknown';
    batchAnalytics.parsingLevelDistribution[level] = (batchAnalytics.parsingLevelDistribution[level] || 0) + 1;
  });

  console.log(`✅ Batch CV parsing completed:`, batchAnalytics);

  return {
    results,
    analytics: batchAnalytics
  };
};

/**
 * 🚀 SMART CV PARSING - Auto-determine parsing level based on job
 */
const parseWithJobContext = async (resumePath, job, options = {}) => {
  const smartParsingLevel = determineParsingLevel(job);

  console.log(`🧠 Smart parsing: Selected ${smartParsingLevel} level for "${job.title}"`);

  return await parseCV(resumePath, {
    parsingLevel: smartParsingLevel,
    job,
    ...options
  });
};

/**
 * 🚀 CV PARSING WITH CANDIDATE UPDATE - Parse and update candidate profile
 */
const parseCVAndUpdateCandidate = async (candidateId, resumePath, job, options = {}) => {
  try {
    // Parse CV with job context
    const parseResult = await parseWithJobContext(resumePath, job, options);

    if (parseResult.success) {
      // Get candidate data for updating
      const candidateData = transformParsedDataForCandidate(parseResult.data, parseResult.extracted);

      console.log(`📝 Updating candidate ${candidateId} with parsed CV data`);

      // Return both parse result and candidate update data
      return {
        parseResult,
        candidateUpdateData: candidateData,
        success: true
      };
    } else {
      console.warn(`⚠️ CV parsing failed for candidate ${candidateId}`);
      return {
        parseResult,
        candidateUpdateData: null,
        success: false
      };
    }
  } catch (error) {
    console.error(`❌ Error in parseCVAndUpdateCandidate for candidate ${candidateId}:`, error);
    throw error;
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract personal information from parsed CV
 */
const extractPersonalInfo = (parseResult) => {
  const personal = parseResult.personal || {};
  return {
    fullName: personal.fullName || null,
    firstName: personal.firstName || null,
    lastName: personal.lastName || null,
    email: personal.email || null,
    phone: personal.phone || null,
    address: personal.address || null,
    city: personal.city || null,
    country: personal.country || null,
    linkedIn: personal.linkedIn || null,
    github: personal.github || null,
    website: personal.website || null
  };
};

/**
 * Extract and format experience data
 */
const extractExperience = (parseResult) => {
  const experiences = parseResult.experience || [];
  return experiences.map(exp => ({
    jobTitle: exp.jobTitle || null,
    company: exp.company || null,
    startDate: exp.startDate || null,
    endDate: exp.endDate || null,
    current: exp.current || false,
    location: exp.location || null,
    description: exp.description || null,
    achievements: exp.achievements || [],
    technologies: exp.technologies || []
  }));
};

/**
 * Extract and format education data
 */
const extractEducation = (parseResult) => {
  const education = parseResult.education || [];
  return education.map(edu => ({
    institution: edu.institution || null,
    degree: edu.degree || null,
    fieldOfStudy: edu.fieldOfStudy || null,
    startDate: edu.startDate || null,
    endDate: edu.endDate || null,
    gpa: edu.gpa || null,
    location: edu.location || null,
    achievements: edu.achievements || []
  }));
};

/**
 * Extract and format skills data
 */
const extractSkills = (parseResult) => {
  const skills = parseResult.skills || {};
  return {
    technical: skills.technical || [],
    soft: skills.soft || [],
    languages: skills.languages || [],
    frameworks: skills.frameworks || [],
    tools: skills.tools || [],
    databases: skills.databases || [],
    all: [
      ...(skills.technical || []),
      ...(skills.soft || []),
      ...(skills.frameworks || []),
      ...(skills.tools || []),
      ...(skills.databases || [])
    ]
  };
};

/**
 * Transform parsed data for candidate profile update
 */
const transformParsedDataForCandidate = (parseResult, extractedData) => {
  const personal = extractedData.personal;
  const experience = extractedData.experience;
  const education = extractedData.education;
  const skills = extractedData.skills;

  return {
    // Basic info (only update if not already present)
    phone: personal.phone,
    currentLocation: personal.address || personal.city,
    city: personal.city,
    country: personal.country,

    // Professional info
    professionalSummary: extractedData.summary,
    totalExperience: extractedData.totalExperience,
    currentJobTitle: getCurrentJobTitle(experience),

    // Social links
    linkedinUrl: personal.linkedIn,
    githubUrl: personal.github,
    portfolioUrl: personal.website,

    // Structured data
    skills: skills.all.length > 0 ? skills : null,
    education: education.length > 0 ? education : null,
    experience: experience.length > 0 ? experience : null,
    certifications: parseResult.certifications || null,
    projects: parseResult.projects || null,
    languages: skills.languages || null,

    // Metadata
    parsedResumeData: parseResult,
    parseConfidence: parseResult.metadata?.parseConfidence || null,
    lastResumeParseDate: new Date(),
    keywords: parseResult.metadata?.keywords || null,

    // Calculated fields
    profileCompleteness: calculateProfileCompleteness({
      firstName: personal.firstName,
      lastName: personal.lastName,
      phone: personal.phone,
      currentLocation: personal.address || personal.city,
      professionalSummary: extractedData.summary,
      totalExperience: extractedData.totalExperience,
      currentJobTitle: getCurrentJobTitle(experience),
      skills: skills.all,
      education: education,
      experience: experience
    })
  };
};

/**
 * Get current job title from most recent experience
 */
const getCurrentJobTitle = (experiences) => {
  if (!experiences || experiences.length === 0) return null;

  const currentJob = experiences.find((exp) => exp.current || !exp.endDate);
  if (currentJob) return currentJob.jobTitle;

  return experiences[0]?.jobTitle || null;
};

/**
 * Calculate total experience in years from experience array
 */
const calculateTotalExperienceYears = (experiences) => {
  if (!experiences || experiences.length === 0) return null;

  let totalMonths = 0;

  experiences.forEach((exp) => {
    if (exp.startDate) {
      const startDate = new Date(exp.startDate);
      const endDate = exp.endDate ? new Date(exp.endDate) : new Date();

      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        const diffTime = Math.abs(endDate - startDate);
        const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44));
        totalMonths += diffMonths;
      }
    }
  });

  if (totalMonths === 0) return null;

  const years = Math.round((totalMonths / 12) * 10) / 10;
  return years;
};

/**
 * Calculate profile completeness percentage
 */
const calculateProfileCompleteness = (data) => {
  const fields = [
    "firstName",
    "lastName",
    "phone",
    "currentLocation",
    "professionalSummary",
    "totalExperience",
    "currentJobTitle",
  ];

  let completedFields = 0;
  fields.forEach((field) => {
    if (data[field] && data[field] !== null && data[field] !== "") {
      completedFields++;
    }
  });

  if (data.skills && Array.isArray(data.skills) && data.skills.length > 0) completedFields += 1;
  if (data.education && Array.isArray(data.education) && data.education.length > 0) completedFields += 1;
  if (data.experience && Array.isArray(data.experience) && data.experience.length > 0) completedFields += 1;

  const totalFields = fields.length + 3;
  return Math.round((completedFields / totalFields) * 100);
};

/**
 * Transform manual parser output to match AI parser format
 */
const transformManualToAIFormat = (manualData) => {
  return {
    personal: {
      fullName:
        manualData.firstName && manualData.lastName
          ? `${manualData.firstName} ${manualData.lastName}`
          : null,
      firstName: manualData.firstName,
      lastName: manualData.lastName,
      email: null,
      phone: manualData.phone,
      address: manualData.currentLocation,
      city: manualData.city,
      country: manualData.country,
      linkedIn: null,
      github: null,
      website: null,
    },
    experience: (manualData.experience || []).map((exp) => ({
      jobTitle: exp.position || exp.title,
      company: exp.company,
      startDate: null,
      endDate: null,
      current: false,
      duration: exp.duration,
      location: null,
      description: exp.description,
      achievements: [],
      technologies: [],
    })),
    education: (manualData.education || []).map((edu) => ({
      institution: edu.institution,
      degree: edu.degree,
      fieldOfStudy: null,
      startDate: null,
      endDate: edu.year,
      gpa: null,
      location: null,
      achievements: [],
    })),
    skills: {
      technical: Array.isArray(manualData.skills) ? manualData.skills : [],
      soft: [],
      languages: [],
      frameworks: [],
      tools: [],
      databases: [],
    },
    certifications: [],
    projects: [],
    summary: manualData.professionalSummary,
    objective: null,
    metadata: {
      parseDate: new Date().toISOString(),
      parseConfidence: 0.7, // Default confidence for manual parsing
      provider: "manual",
      model: "manual-parser",
      keywords: [],
    },
  };
};

/**
 * Get empty parse result structure
 */
const getEmptyParseResult = () => {
  return {
    personal: {},
    experience: [],
    education: [],
    skills: {},
    certifications: [],
    projects: [],
    summary: null,
    metadata: {
      parseConfidence: 0,
      provider: "none",
      keywords: [],
    },
  };
};

/**
 * Check if error is from AI provider (API limits, network, etc.)
 */
const isAIProviderError = (error) => {
  const providerErrorIndicators = [
    "API key",
    "rate limit",
    "quota exceeded",
    "network",
    "timeout",
    "service unavailable",
    "internal server error",
    "authentication",
    "authorization",
    "fetch",
    "ECONNREFUSED",
    "ETIMEDOUT",
  ];

  const errorMessage = error.message.toLowerCase();
  return providerErrorIndicators.some((indicator) =>
    errorMessage.includes(indicator.toLowerCase()),
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Main parsing functions
  parseCV,
  parseCVBatch,
  parseWithJobContext,
  parseCVAndUpdateCandidate,

  // Configuration functions
  determineParsingLevel,
  getParsingLevelInfo,
  createCVParser,

  // Helper functions
  extractPersonalInfo,
  extractExperience,
  extractEducation,
  extractSkills,
  transformParsedDataForCandidate,
  getCurrentJobTitle,
  calculateTotalExperienceYears,
  calculateProfileCompleteness,

  // Utility functions
  transformManualToAIFormat,
  getEmptyParseResult,
  isAIProviderError
};