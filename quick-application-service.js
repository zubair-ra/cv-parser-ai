const db = require("../models");
const crypto = require("crypto");
const { hashPassword } = require("../../utils/hash");
const { sendEmail } = require("../../utils/email");
const ResumeParser = require("../../utils/resumeParser");
const CVParser = require("cv-parser-ai-tb");
const { jobApplicationTemplate } = require("../template/emailTemplate");

const User = db.User;
const Candidate = db.Candidate;
const Application = db.Application;
const Job = db.Job;
const Client = db.Client;

/**
 * Determine parsing level based on job requirements and priority
 */
const determineParsingLevel = (job, applicationData = {}) => {
  // Check if forced parsing is enabled and level is set
  const forceParsingLevel = process.env.FORCE_PARSING_LEVEL === "true";
  const forcedLevel = process.env.CV_PARSING_LEVEL;

  if (
    forceParsingLevel &&
    forcedLevel &&
    ["low", "moderate", "high", "ultra"].includes(forcedLevel.toLowerCase())
  ) {
    console.log(`🔒 Using forced parsing level from env: ${forcedLevel}`);
    return forcedLevel.toLowerCase();
  }

  const jobTitle = (job.title || "").toLowerCase();
  const jobType = (job.jobType || "").toLowerCase();
  const salary = job.salary || 0;

  // High-priority positions require detailed parsing
  if (
    jobTitle.includes("senior") ||
    jobTitle.includes("lead") ||
    jobTitle.includes("manager") ||
    jobTitle.includes("director") ||
    jobTitle.includes("head") ||
    jobTitle.includes("principal") ||
    jobTitle.includes("architect") ||
    salary > 100000
  ) {
    return "high";
  }

  // Technical roles that need skill extraction
  if (
    jobTitle.includes("developer") ||
    jobTitle.includes("engineer") ||
    jobTitle.includes("programmer") ||
    jobTitle.includes("analyst") ||
    jobTitle.includes("specialist") ||
    jobType.includes("technical")
  ) {
    return "moderate";
  }

  // Entry level or simple roles
  if (
    jobTitle.includes("junior") ||
    jobTitle.includes("intern") ||
    jobTitle.includes("entry") ||
    jobTitle.includes("assistant") ||
    jobTitle.includes("trainee") ||
    salary < 40000
  ) {
    return "low";
  }

  // C-level or very senior positions
  if (
    jobTitle.includes("ceo") ||
    jobTitle.includes("cto") ||
    jobTitle.includes("cfo") ||
    jobTitle.includes("chief") ||
    jobTitle.includes("president") ||
    jobTitle.includes("vice president") ||
    salary > 200000
  ) {
    return "ultra";
  }

  // Default for most positions
  return "moderate";
};

/**
 * Get parsing level configuration and cost information
 */
const getParsingLevelInfo = (level) => {
  const levels = {
    low: {
      description: "Basic info extraction (name, email, phone)",
      estimatedTokens: 200,
      speed: "Fastest",
      costMultiplier: 1.0,
    },
    moderate: {
      description:
        "Balanced extraction (personal, experience, education, skills)",
      estimatedTokens: 500,
      speed: "Fast",
      costMultiplier: 2.5,
    },
    high: {
      description: "Detailed extraction with comprehensive data",
      estimatedTokens: 1000,
      speed: "Medium",
      costMultiplier: 5.0,
    },
    ultra: {
      description: "Complete extraction with full details and analysis",
      estimatedTokens: 2000,
      speed: "Thorough",
      costMultiplier: 10.0,
    },
  };

  return levels[level] || levels["moderate"];
};

/**
 * List of available Gemini models in order of preference
 * Based on performance, availability, and cost effectiveness
 */
const GEMINI_MODELS = [
  "models/gemini-1.5-flash-8b",
  "models/gemini-1.5-flash-8b-001",
  "models/gemini-2.0-flash-lite",
  "models/gemini-2.0-flash-lite-001",
  "models/gemini-1.5-flash",
  "models/gemini-1.5-flash-002",
  "models/gemini-2.0-flash",
  "models/gemini-2.0-flash-001",
  "models/gemini-1.5-pro",
  "models/gemini-1.5-pro-002",
  "models/gemini-2.5-flash",
  "models/gemini-2.5-pro",
];

/**
 * Create CV Parser instance with dynamic configuration
 */
const modelName = process.env.CV_MODEL || "gemini-1.5-flash";

const createCVParser = (parsingLevel = "moderate", model = modelName) => {
  return new CVParser({
    apiKey: process.env.CV_API_KEY,
    provider: process.env.CV_PROVIDER,
    model: model,
    parsingLevel: parsingLevel,
    includeMetadata: true,
    normalizeData: true,
    confidenceThreshold: 0.6,
  });
};

/**
 * Parse CV with model fallback system
 * Tries different Gemini models if one fails
 */
const parseWithFallback = async (resumePath, parsingLevel = "moderate") => {
  let lastError = null;

  // Start with the configured model first
  const modelsToTry = [
    modelName,
    ...GEMINI_MODELS.filter((m) => m !== modelName),
  ];

  for (const model of modelsToTry) {
    try {
      console.log(`Background: Attempting CV parsing with model: ${model}`);
      const cvParser = createCVParser(parsingLevel, model);
      const result = await cvParser.parse(resumePath);

      console.log(`Background: CV parsing successful with model: ${model}`);

      // Add model info to metadata
      if (result.metadata) {
        result.metadata.modelUsed = model;
        result.metadata.fallbackAttempt = modelsToTry.indexOf(model);
      }

      return result;
    } catch (error) {
      console.warn(`Background: Model ${model} failed:`, error.message);
      lastError = error;

      // Skip to next model if this one is not found or access denied
      if (
        error.message?.includes("404") ||
        error.message?.includes("not found") ||
        error.message?.includes("access")
      ) {
        continue;
      }

      // For other errors, also try the next model but with a shorter delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // If all models failed, throw the last error
  throw new Error(
    `All Gemini models failed. Last error: ${lastError?.message || "Unknown error"}`,
  );
};

/**
 * Get current job title from most recent experience
 */
function getCurrentJobTitle(experiences) {
  if (!experiences || experiences.length === 0) return null;

  const currentJob = experiences.find((exp) => exp.current || !exp.endDate);
  if (currentJob) return currentJob.jobTitle;

  return experiences[0]?.jobTitle || null;
}

/**
 * Calculate profile completeness percentage
 */
function calculateProfileCompleteness(data) {
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

  if (data.skills && Object.keys(data.skills).length > 0) completedFields += 1;
  if (data.education && data.education.length > 0) completedFields += 1;
  if (data.experience && data.experience.length > 0) completedFields += 1;

  const totalFields = fields.length + 3;
  return Math.round((completedFields / totalFields) * 100);
}

/**
 * Get empty parse result structure
 */
function getEmptyParseResult() {
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
}

/**
 * Calculate total experience in years from experience array
 */
function calculateTotalExperienceYears(experiences) {
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
}

/**
 * Transform manual parser output to match AI parser format
 */
function transformManualToAIFormat(manualData) {
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
    experience: manualData.experience.map((exp) => ({
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
    education: manualData.education.map((edu) => ({
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
      parseConfidence: 0.7,
      provider: "manual",
      model: "manual-parser",
      keywords: [],
    },
  };
}

const sendApplicationConfirmationEmail = async (user, job) => {
  const subject = `Application Received -- ${job.title}`;
  const html = jobApplicationTemplate(user.name);

  await sendEmail(user.email, subject, html);
};

/**
 * Helper function for immediate response message with parsing level info
 */
const generateImmediateResponseMessage = (isNewUser, parsingLevel) => {
  const levelInfo = getParsingLevelInfo(parsingLevel);

  const baseMessage = isNewUser
    ? "Application submitted successfully! We've created your account and are processing your resume in the background."
    : "Application submitted successfully! We're processing your resume in the background to update your profile.";

  return `${baseMessage} Using ${parsingLevel} level parsing (${levelInfo.description}) for optimal processing. You'll receive a confirmation email shortly.`;
};

/**
 * Send processing completion notification (internal use)
 */
const sendCVProcessingCompletionNotification = async (
  candidateId,
  job,
  parsingInfo,
) => {
  console.log(`📊 CV Processing Analytics:`, {
    candidateId,
    jobTitle: job.title,
    parsingLevel: parsingInfo.parsingLevel,
    tokensUsed: parsingInfo.tokensUsed,
    confidence: parsingInfo.confidence,
    method: parsingInfo.method,
    timestamp: new Date().toISOString(),
  });
};

/**
 * BACKGROUND PROCESSING FUNCTION with Dynamic Parsing Level
 */
const processResumeInBackground = async (
  candidateId,
  applicationId,
  resumePath,
  job,
  parsingLevel = "moderate",
) => {
  console.log(
    `🎯 Starting background CV processing for candidate ${candidateId} with parsing level: ${parsingLevel}`,
  );

  try {
    let parseResult = {};
    let parseSuccess = false;
    let parsingMethod = "none";
    let actualTokensUsed = 0;

    try {
      console.log(
        `Background: Starting resume parsing with CV Parser AI (Level: ${parsingLevel})...`,
      );

      parseResult = await parseWithFallback(resumePath, parsingLevel);

      console.log("Background: CV Parser AI returned result:", parseResult);
      // Get token usage from the parse result metadata or estimate based on parsing level
      actualTokensUsed =
        parseResult.metadata?.tokensUsed ||
        parseResult.metadata?.estimatedTokens ||
        getParsingLevelInfo(parsingLevel).estimatedTokens;

      console.log(
        `Background: CV Parser AI successful with ${parsingLevel} level:`,
        {
          confidence: parseResult.metadata?.parseConfidence,
          provider: parseResult.metadata?.provider,
          model: parseResult.metadata?.modelUsed || "unknown",
          fallbackAttempt: parseResult.metadata?.fallbackAttempt || 0,
          tokensUsed: actualTokensUsed,
          parsingLevel: parsingLevel,
        },
      );

      parseSuccess = true;
      parsingMethod = "ai";
    } catch (aiError) {
      console.warn(
        `Background: CV Parser AI failed with ${parsingLevel} level, attempting manual fallback:`,
        aiError.message,
      );

      try {
        console.log("Background: Starting manual resume parsing...");

        const manualResult = await ResumeParser.parseResume(resumePath);
        console.log("Background: Manual parser successful");

        parseResult = transformManualToAIFormat(manualResult);
        parseSuccess = true;
        parsingMethod = "manual";
        actualTokensUsed = getParsingLevelInfo("moderate").estimatedTokens;
      } catch (manualError) {
        console.error(
          "Background: Manual parser also failed:",
          manualError.message,
        );
        parseResult = getEmptyParseResult();
        parseSuccess = false;
        parsingMethod = "failed";
        actualTokensUsed = 0;
      }
    }

    if (parseSuccess) {
      const personal = parseResult.personal || {};
      const totalExperience = calculateTotalExperienceYears(
        parseResult.experience || [],
      );

      const candidate = await Candidate.findByPk(candidateId);

      await candidate.update({
        currentLocation:
          personal.address ||
          personal.currentLocation ||
          candidate.currentLocation,
        professionalSummary:
          parseResult.summary ||
          parseResult.objective ||
          candidate.professionalSummary,
        totalExperience: totalExperience || candidate.totalExperience,
        currentJobTitle:
          getCurrentJobTitle(parseResult.experience) ||
          candidate.currentJobTitle,
        linkedinUrl: personal.linkedIn || candidate.linkedinUrl,
        githubUrl: personal.github || candidate.githubUrl,
        portfolioUrl: personal.website || candidate.portfolioUrl,
        skills: parseResult.skills || candidate.skills,
        education: parseResult.education || candidate.education,
        experience: parseResult.experience || candidate.experience,
        certifications: parseResult.certifications || candidate.certifications,
        projects: parseResult.projects || candidate.projects,
        languages: parseResult.skills?.languages || candidate.languages,
        parsedResumeData: parseResult,
        parseConfidence: parseResult.metadata?.parseConfidence || null,
        lastResumeParseDate: new Date(),
        keywords: parseResult.metadata?.keywords || candidate.keywords,
        profileCompleteness: calculateProfileCompleteness({
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          phone: personal.phone,
          currentLocation: personal.address || personal.currentLocation,
          professionalSummary: parseResult.summary,
          totalExperience: totalExperience,
          currentJobTitle: getCurrentJobTitle(parseResult.experience),
          skills: parseResult.skills,
          education: parseResult.education,
          experience: parseResult.experience,
        }),
      });

      await Application.update(
        {
          parsedResumeData: JSON.stringify({
            parseMetadata: {
              success: parseSuccess,
              method: parsingMethod,
              parsingLevel: parsingLevel,
              actualTokensUsed: actualTokensUsed,
              estimatedTokens:
                getParsingLevelInfo(parsingLevel).estimatedTokens,
              costMultiplier: getParsingLevelInfo(parsingLevel).costMultiplier,
              confidence: parseResult.metadata?.parseConfidence || null,
              provider: parseResult.metadata?.provider || parsingMethod,
              parseDate: new Date().toISOString(),
              jobTitle: job.title,
              parsingLevelReason: `Auto-selected ${parsingLevel} level for ${job.title}`,
            },
            extractedData: {
              skillsCount:
                parseResult.skills?.technical?.length ||
                parseResult.skills?.length ||
                0,
              experienceCount: parseResult.experience?.length || 0,
              educationCount: parseResult.education?.length || 0,
              certificationsCount: parseResult.certifications?.length || 0,
              projectsCount: parseResult.projects?.length || 0,
              languagesCount: parseResult.skills?.languages?.length || 0,
            },
            costAnalysis: {
              parsingLevel: parsingLevel,
              tokensUsed: actualTokensUsed,
              estimatedCost: (actualTokensUsed * 0.0005) / 1000,
              efficiency: parsingMethod === "ai" ? "optimal" : "fallback",
            },
          }),
        },
        { where: { id: applicationId } },
      );

      console.log(
        `Background: CV processing completed successfully for candidate ${candidateId} using ${parsingLevel} level (${actualTokensUsed} tokens)`,
      );

      await sendCVProcessingCompletionNotification(candidateId, job, {
        parsingLevel,
        tokensUsed: actualTokensUsed,
        confidence: parseResult.metadata?.parseConfidence,
        method: parsingMethod,
      });
    } else {
      console.log(
        `Background: CV processing failed for candidate ${candidateId} with ${parsingLevel} level`,
      );

      await Application.update(
        {
          parsedResumeData: JSON.stringify({
            parseMetadata: {
              success: false,
              method: "failed",
              parsingLevel: parsingLevel,
              actualTokensUsed: 0,
              estimatedTokens:
                getParsingLevelInfo(parsingLevel).estimatedTokens,
              confidence: 0,
              provider: "none",
              parseDate: new Date().toISOString(),
              jobTitle: job.title,
              parsingLevelReason: `Failed to parse with ${parsingLevel} level for ${job.title}`,
            },
            extractedData: {
              skillsCount: 0,
              experienceCount: 0,
              educationCount: 0,
              certificationsCount: 0,
              projectsCount: 0,
              languagesCount: 0,
            },
            costAnalysis: {
              parsingLevel: parsingLevel,
              tokensUsed: 0,
              estimatedCost: 0,
              efficiency: "failed",
            },
          }),
        },
        { where: { id: applicationId } },
      );
    }
  } catch (error) {
    console.error(
      `Background: Error processing CV for candidate ${candidateId} with ${parsingLevel} level:`,
      error,
    );

    await Application.update(
      {
        parsedResumeData: JSON.stringify({
          parseMetadata: {
            success: false,
            method: "error",
            parsingLevel: parsingLevel,
            actualTokensUsed: 0,
            confidence: 0,
            provider: "none",
            parseDate: new Date().toISOString(),
            error: error.message,
            jobTitle: job.title,
            parsingLevelReason: `Error during ${parsingLevel} level parsing for ${job.title}`,
          },
          extractedData: {
            skillsCount: 0,
            experienceCount: 0,
            educationCount: 0,
            certificationsCount: 0,
            projectsCount: 0,
            languagesCount: 0,
          },
          costAnalysis: {
            parsingLevel: parsingLevel,
            tokensUsed: 0,
            estimatedCost: 0,
            efficiency: "error",
          },
        }),
      },
      { where: { id: applicationId } },
    );
  }
};

/**
 * Submit quick application with dynamic parsing level optimization
 */
const submitQuickApplication = async (
  applicationData,
  resumeFile,
  bypassEmailAndJobRestriction = false,
) => {
  console.log("Starting quick application submission...");
  console.log("Application Data:", applicationData);

  // Check if bypass flag is in applicationData (from frontend)
  const actualBypassFlag =
    bypassEmailAndJobRestriction ||
    applicationData.bypassEmailAndJobRestriction === "true" ||
    applicationData.bypassEmailAndJobRestriction === true;

  const transaction = await db.sequelize.transaction();

  console.log(`applicationData.jobId Restriction: ${applicationData.jobId}`);
  try {
    let job = null;

    if (applicationData.jobId && applicationData.jobId !== "") {
      console.log(
        `applicationData.jobId Restriction -->2: ${applicationData.jobId}`,
      );

      job = await Job.findOne({
        where: {
          id: applicationData.jobId,
          status: "active",
        },
        include: [{ model: Client, as: "client", attributes: ["name"] }],
      });

      if (!job) {
        throw new Error("Job not found or no longer active");
      }
    } else {
      // When bypassing, create a mock job object for parsing level determination
      job = {
        id: null,
        title: "Manual Entry",
        jobType: "general",
        salary: 0,
        status: "active",
      };
    }

    const selectedParsingLevel = determineParsingLevel(job, applicationData);
    const parsingLevelInfo = getParsingLevelInfo(selectedParsingLevel);

    console.log(
      `🎯 Selected parsing level: ${selectedParsingLevel} (${parsingLevelInfo.description})`,
    );

    let firstName = applicationData.firstName;
    let lastName = applicationData.lastName;

    if (!firstName || !lastName) {
      const nameParts = applicationData.fullName.trim().split(/\s+/);
      firstName = firstName || nameParts[0];
      lastName =
        lastName || (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "");
    }

    let user = await User.findOne({ where: { email: applicationData.email } });
    let candidate;
    let isNewUser = false;

    if (user) {
      candidate = await Candidate.findOne({ where: { userId: user.id } });
      if (!candidate) {
        throw new Error("User exists but candidate profile not found");
      }

      if (
        !actualBypassFlag &&
        applicationData.jobId &&
        applicationData.jobId !== ""
      ) {
        const existingApplication = await Application.findOne({
          where: { jobId: applicationData.jobId, candidateId: candidate.id },
        });

        if (existingApplication) {
          throw new Error("You have already applied for this job");
        }
      }

      await candidate.update(
        {
          firstName: firstName,
          lastName: lastName,
          email: applicationData.email,
          city: applicationData.city,
          country: applicationData.country,
          phone: applicationData.phone,
          resumePath: resumeFile
            ? `/uploads/resumes/${resumeFile.filename}`
            : candidate.resumePath,
        },
        { transaction },
      );
    } else {
      isNewUser = true;
      const tempPassword = crypto.randomBytes(8).toString("hex");
      const hashedPassword = await hashPassword(tempPassword);

      user = await User.create(
        {
          name: applicationData.fullName,
          email: applicationData.email,
          password: hashedPassword,
          roleId: 20,
          isVerified: false,
        },
        { transaction },
      );

      candidate = await Candidate.create(
        {
          userId: user.id,
          firstName: firstName,
          lastName: lastName,
          email: applicationData.email,
          city: applicationData.city,
          country: applicationData.country,
          phone: applicationData.phone,
          resumePath: resumeFile
            ? `/uploads/resumes/${resumeFile.filename}`
            : null,
          isActivelyLooking: true,
          profileCompleteness: 30,
        },
        { transaction },
      );

      user.tempPassword = tempPassword;
    }

    const application = await Application.create(
      {
        jobId:
          applicationData.jobId && applicationData.jobId !== ""
            ? applicationData.jobId
            : null,
        candidateId: candidate.id,
        coverLetter: applicationData.coverLetter || null,
        resumePath: resumeFile
          ? `/uploads/resumes/${resumeFile.filename}`
          : candidate.resumePath,
        status: "applied",
        parsingLevel: selectedParsingLevel,
        parsedResumeData: JSON.stringify({
          parseMetadata: {
            success: false,
            method: "pending",
            parsingLevel: selectedParsingLevel,
            estimatedTokens: parsingLevelInfo.estimatedTokens,
            costMultiplier: parsingLevelInfo.costMultiplier,
            confidence: null,
            provider: "pending",
            parseDate: new Date().toISOString(),
          },
          extractedData: {
            skillsCount: 0,
            experienceCount: 0,
            educationCount: 0,
            certificationsCount: 0,
            projectsCount: 0,
          },
        }),
      },
      { transaction },
    );

    if (
      applicationData.jobId &&
      applicationData.jobId !== "" &&
      job &&
      job.id
    ) {
      await job.increment("applicationCount", { transaction });
    }
    await transaction.commit();

    const applicationWithDetails = await Application.findByPk(application.id, {
      include: [
        {
          model: Job,
          as: "job",
          attributes: ["id", "title", "location"],
          include: [{ model: Client, as: "client", attributes: ["name"] }],
        },
        {
          model: Candidate,
          attributes: ["firstName", "lastName", "email", "phone"],
          include: [{ model: User, attributes: ["email"] }],
        },
      ],
    });

    if (!actualBypassFlag) {
      if (isNewUser) {
        await sendApplicationConfirmationEmail(user, job, user.tempPassword);
      } else {
        await sendApplicationConfirmationEmail(user, job);
      }
    }

    if (resumeFile) {
      processResumeInBackground(
        candidate.id,
        application.id,
        resumeFile.path,
        job,
        selectedParsingLevel,
      );
    }

    return {
      application: applicationWithDetails.get({ plain: true }),
      isNewUser,
      parseSuccess: false,
      parsingMethod: "pending",
      parsingLevel: selectedParsingLevel,
      parsingLevelInfo: parsingLevelInfo,
      parseConfidence: 0,
      extractedData: {
        personalInfo: true,
        skillsCount: 0,
        experienceCount: 0,
        educationCount: 0,
        projectsCount: 0,
      },
      message: generateImmediateResponseMessage(
        isNewUser,
        selectedParsingLevel,
      ),
    };
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error("Error submitting quick application:", error);
    throw new Error(error.message || "Failed to submit application");
  }
};

module.exports = {
  submitQuickApplication,
};
