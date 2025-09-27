const db = require("../models");
const { Op } = require("sequelize");
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
const Client = db.Client; // Changed from Company to Client

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
      description: 'Balanced extraction (personal, experience, education, skills)',
      estimatedTokens: 500,
      speed: 'Fast',
      costMultiplier: 2.5
    },
    'high': {
      description: 'Detailed extraction with comprehensive data',
      estimatedTokens: 1000,
      speed: 'Medium',
      costMultiplier: 5.0
    },
    'ultra': {
      description: 'Complete extraction with full details and analysis',
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
 * Submit application as guest user
 */
const submitGuestApplication = async (applicationData, resumeFile) => {
  const transaction = await db.sequelize.transaction();

  try {
    const job = await Job.findOne({
      where: {
        id: applicationData.jobId,
        status: "active",
      },
      include: [{ model: Client, as: "client", attributes: ["name"] }], // Added alias
    });

    if (!job) {
      throw new Error("Job not found or no longer active");
    }

    let user = await User.findOne({ where: { email: applicationData.email } });
    let candidate;
    let isNewUser = false;

    if (user) {
      candidate = await Candidate.findOne({ where: { userId: user.id } });
      if (!candidate) {
        throw new Error("User exists but candidate profile not found");
      }

      const existingApplication = await Application.findOne({
        where: { jobId: applicationData.jobId, candidateId: candidate.id },
      });

      if (existingApplication) {
        throw new Error("You have already applied for this job");
      }
    } else {
      isNewUser = true;
      const tempPassword = crypto.randomBytes(8).toString("hex");
      const hashedPassword = await hashPassword(tempPassword);

      user = await User.create(
        {
          name: `${applicationData.firstName} ${applicationData.lastName}`,
          email: applicationData.email,
          password: hashedPassword,
          roleId: 2,
          isVerified: false,
        },
        { transaction },
      );

      candidate = await Candidate.create(
        {
          userId: user.id,
          firstName: applicationData.firstName,
          lastName: applicationData.lastName,
          phone: applicationData.phone,
          currentLocation: applicationData.currentLocation,
          city: applicationData.city,
          country: applicationData.country,
          professionalSummary: applicationData.professionalSummary,
          totalExperience: applicationData.totalExperience,
          currentJobTitle: applicationData.currentJobTitle,
          expectedSalary: applicationData.expectedSalary,
          workMode: applicationData.workMode,
          jobType: applicationData.jobType,
          resumePath: resumeFile
            ? `/uploads/resumes/${resumeFile.filename}`
            : null,
          profileCompleteness: calculateProfileCompleteness(applicationData),
          isActivelyLooking: true,
        },
        { transaction },
      );

      user.tempPassword = tempPassword;
    }

    const application = await Application.create(
      {
        jobId: applicationData.jobId,
        candidateId: candidate.id,
        coverLetter: applicationData.coverLetter,
        resumePath: resumeFile
          ? `/uploads/resumes/${resumeFile.filename}`
          : candidate.resumePath,
        status: "applied",
      },
      { transaction },
    );

    await job.increment("applicationCount", { transaction });

    await transaction.commit(); // ✅ Commit done here

    // These steps are outside transaction scope and can throw errors — so we don't rollback anymore
    if (isNewUser) {
      await sendApplicationConfirmationEmail(user, job, user.tempPassword);
    } else {
      await sendApplicationConfirmationEmail(user, job);
    }

    const applicationWithDetails = await Application.findByPk(application.id, {
      include: [
        {
          model: Job,
          as: "job",
          attributes: ["id", "title", "location"],
          include: [{ model: Client, as: "client", attributes: ["name"] }], // Added alias
        },
        {
          model: Candidate,
          attributes: ["firstName", "lastName", "email", "phone"],
          include: [{ model: User, attributes: ["email"] }],
        },
      ],
    });

    return {
      application: applicationWithDetails.get({ plain: true }),
      isNewUser,
      message: isNewUser
        ? "Application submitted successfully! Check your email for login credentials."
        : "Application submitted successfully!",
    };
  } catch (error) {
    // ✅ Only rollback if transaction is not finished
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error("Error submitting application:", error);
    throw new Error(error.message || "Failed to submit application");
  }
};

/**
 * Get applications with filters for admin/employer dashboard
 */
const getApplications = async (filters = {}) => {
  try {
    const whereClause = {};
    const candidateWhere = {};
    const jobWhere = {};

    // Apply filters
    if (filters.jobId) {
      whereClause.jobId = filters.jobId;
    }

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.dateFrom || filters.dateTo) {
      whereClause.appliedAt = {};
      if (filters.dateFrom) {
        whereClause.appliedAt[Op.gte] = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        whereClause.appliedAt[Op.lte] = new Date(filters.dateTo);
      }
    }

    if (filters.location) {
      candidateWhere.currentLocation = { [Op.iLike]: `%${filters.location}%` };
    }

    if (filters.experience) {
      candidateWhere.totalExperience = {
        [Op.gte]: parseFloat(filters.experience),
      };
    }

    if (filters.search) {
      candidateWhere[Op.or] = [
        { firstName: { [Op.iLike]: `%${filters.search}%` } },
        { lastName: { [Op.iLike]: `%${filters.search}%` } },
        { currentJobTitle: { [Op.iLike]: `%${filters.search}%` } },
      ];
    }

    const applications = await Application.findAll({
      where: whereClause,
      include: [
        {
          model: Candidate,
          where:
            Object.keys(candidateWhere).length > 0 ? candidateWhere : undefined,
          attributes: [
            "id",
            "firstName",
            "lastName",
            "phone",
            "currentLocation",
            "city",
            "country",
            "professionalSummary",
            "totalExperience",
            "currentJobTitle",
            "expectedSalary",
            "resumePath",
            "workMode",
            "jobType",
            "skills",
            "experience",
            "education",
            "linkedinUrl",
          ],
          include: [
            {
              model: User,
              attributes: ["email"],
            },
          ],
        },
        {
          model: Job,
          as: "job",
          where: Object.keys(jobWhere).length > 0 ? jobWhere : undefined,
          attributes: ["id", "title", "location", "jobType"],
          include: [
            {
              model: Client, // Changed Company to Client
              as: "client", // Added alias
              attributes: ["name"],
            },
          ],
        },
      ],
      order: [["appliedAt", "DESC"]],
      limit: filters.limit || 20,
      offset: filters.offset || 0,
    });

    return applications.map((app) => app.get({ plain: true }));
  } catch (error) {
    console.error("Error fetching applications:", error);
    throw new Error("Failed to fetch applications");
  }
};

/**
 * Get application statistics for dashboard
 */
const getApplicationStatistics = async () => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalApplications,
      newApplications,
      reviewedApplications,
      shortlistedApplications,
      interviewedApplications,
      rejectedApplications,
    ] = await Promise.all([
      Application.count(),
      Application.count({ where: { status: "applied" } }),
      Application.count({ where: { status: "reviewed" } }),
      Application.count({ where: { status: "shortlisted" } }),
      Application.count({ where: { status: "interviewed" } }),
      Application.count({ where: { status: "rejected" } }),
    ]);

    return {
      totalApplications,
      newApplications,
      reviewedApplications,
      shortlistedApplications,
      interviewedApplications,
      rejectedApplications,
      thisMonth: await Application.count({
        where: { appliedAt: { [Op.gte]: startOfMonth } },
      }),
    };
  } catch (error) {
    console.error("Error fetching application statistics:", error);
    throw new Error("Failed to fetch application statistics");
  }
};

/**
 * Update application status
 */
const updateApplicationStatus = async (applicationId, updateData) => {
  try {
    const application = await Application.findByPk(applicationId, {
      include: [
        { model: Candidate, include: [{ model: User, attributes: ["email"] }] },
        { model: Job, as: "job", attributes: ["title"] },
      ],
    });

    if (!application) {
      throw new Error("Application not found");
    }

    await application.update({
      status: updateData.status,
    });

    // // Send status update email to candidate
    // await sendStatusUpdateEmail(
    //   application.Candidate.User.email,
    //   application.Candidate.firstName,
    //   application.job.title,
    //   updateData.status,
    //   updateData.notes,
    // );

    return application.get({ plain: true });
  } catch (error) {
    console.error("Error updating application status:", error);
    throw new Error(error.message || "Failed to update application status");
  }
};

/**
 * Bulk update application status
 */
const bulkUpdateApplications = async (applicationIds, updateData) => {
  const transaction = await db.sequelize.transaction();

  try {
    const applications = await Application.findAll({
      where: { id: { [Op.in]: applicationIds } },
      include: [
        { model: Candidate, include: [{ model: User, attributes: ["email"] }] },
        { model: Job, as: "job", attributes: ["title"] },
      ],
      transaction,
    });

    if (applications.length !== applicationIds.length) {
      throw new Error("Some applications not found");
    }

    // Update all applications
    await Application.update(
      { status: updateData.status },
      { where: { id: { [Op.in]: applicationIds } }, transaction },
    );

    // Send emails to all candidates
    // const emailPromises = applications.map((app) =>
    //   sendStatusUpdateEmail(
    //     app.Candidate.User.email,
    //     app.Candidate.firstName,
    //     app.job.title,
    //     updateData.status,
    //     updateData.notes,
    //   ),
    // );

    //await Promise.all(emailPromises);
    await transaction.commit();

    return {
      updated: applications.length,
      message: `${applications.length} applications updated successfully`,
    };
  } catch (error) {
    await transaction.rollback();
    console.error("Error bulk updating applications:", error);
    throw new Error(error.message || "Failed to bulk update applications");
  }
};

/**
 * Get application details by ID
 */
const getApplicationById = async (applicationId) => {
  try {
    const application = await Application.findByPk(applicationId, {
      include: [
        {
          model: Candidate,
          attributes: [
            "firstName",
            "lastName",
            "phone",
            "currentLocation",
            "city",
            "country",
            "professionalSummary",
            "totalExperience",
            "currentJobTitle",
            "expectedSalary",
            "resumePath",
            "workMode",
            "jobType",
            "skills",
            "experience",
            "education",
            "linkedinUrl",
          ],
          include: [{ model: User, attributes: ["email"] }],
        },
        {
          model: Job,
          as: "job",
          attributes: ["id", "title", "location", "jobType", "salary"],
          include: [
            { model: Client, as: "client", attributes: ["name", "location"] },
          ], // Added alias
        },
      ],
    });

    if (!application) {
      throw new Error("Application not found");
    }

    return application.get({ plain: true });
  } catch (error) {
    console.error("Error fetching application details:", error);
    throw new Error(error.message || "Failed to fetch application details");
  }
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

const sendApplicationConfirmationEmail = async (user, job) => {
  const subject = `Application Received -- ${job.title}`;
  const html = jobApplicationTemplate(user.name);

  await sendEmail(user.email, subject, html);
};

const sendStatusUpdateEmail = async (
  email,
  firstName,
  jobTitle,
  status,
  notes,
) => {
  const statusMessages = {
    reviewed: "has been reviewed",
    shortlisted: "has been shortlisted",
    interviewed: "interview has been scheduled",
    rejected: "was not selected",
    hired: "has been accepted - Congratulations!",
  };

  const subject = `Application Update - ${jobTitle}`;
  const html = `
    <h2>Application Status Update</h2>
    <p>Dear ${firstName},</p>
    <p>Your application for <strong>${jobTitle}</strong> ${statusMessages[status]}.</p>
    ${notes ? `<strong>Additional Notes:</strong> ${notes}` : ""}
    <p>Best regards,<br>The Recruitment Team</p>
  `;

  await sendEmail(email, subject, html);
};

/**
 * Submit quick application with dynamic parsing level optimization
 */
const submitQuickApplication = async (applicationData, resumeFile) => {
  console.log("Starting quick application submission...");
  console.log("Application Data:", applicationData);
  const transaction = await db.sequelize.transaction();

  try {
    const job = await Job.findOne({
      where: {
        id: applicationData.jobId,
        status: "active",
      },
      include: [{ model: Client, as: "client", attributes: ["name"] }],
    });

    if (!job) {
      throw new Error("Job not found or no longer active");
    }

    // 🚀 NEW: Determine optimal parsing level for this job
    const selectedParsingLevel = determineParsingLevel(job, applicationData);
    const parsingLevelInfo = getParsingLevelInfo(selectedParsingLevel);

    console.log(`🎯 Selected parsing level: ${selectedParsingLevel} (${parsingLevelInfo.description})`);

    // STEP 1: IMMEDIATE APPLICATION SUBMISSION (No CV Parsing)
    // Extract basic info from form data
    let firstName = applicationData.firstName;
    let lastName = applicationData.lastName;

    // Fallback to fullName if individual names are missing
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

      const existingApplication = await Application.findOne({
        where: { jobId: applicationData.jobId, candidateId: candidate.id },
      });

      if (existingApplication) {
        throw new Error("You have already applied for this job");
      }

      // Update basic candidate info from form (without CV parsing)
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
          profileCompleteness: 30, // Basic completion score
        },
        { transaction },
      );

      user.tempPassword = tempPassword;
    }

    // Create application immediately with parsing level info
    const application = await Application.create(
      {
        jobId: applicationData.jobId,
        candidateId: candidate.id,
        coverLetter: applicationData.coverLetter || null,
        resumePath: resumeFile
          ? `/uploads/resumes/${resumeFile.filename}`
          : candidate.resumePath,
        status: "applied",
        // 🚀 NEW: Store parsing level and estimated cost
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

    await job.increment("applicationCount", { transaction });
    await transaction.commit();

    // STEP 2: IMMEDIATE SUCCESS RESPONSE
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

    // Send immediate confirmation email
    if (isNewUser) {
      await sendApplicationConfirmationEmail(user, job, user.tempPassword);
    } else {
      await sendApplicationConfirmationEmail(user, job);
    }

    // STEP 3: BACKGROUND CV PROCESSING (Fire and Forget) with dynamic parsing level
    if (resumeFile) {
      // Process CV in background without blocking the response
      processResumeInBackground(
        candidate.id,
        application.id,
        resumeFile.path,
        job,
        selectedParsingLevel // 🚀 NEW: Pass selected parsing level
      );
    }

    return {
      application: applicationWithDetails.get({ plain: true }),
      isNewUser,
      parseSuccess: false, // Will be updated in background
      parsingMethod: "pending",
      parsingLevel: selectedParsingLevel, // 🚀 NEW: Return selected level
      parsingLevelInfo: parsingLevelInfo, // 🚀 NEW: Return level details
      parseConfidence: 0,
      extractedData: {
        personalInfo: true,
        skillsCount: 0,
        experienceCount: 0,
        educationCount: 0,
        projectsCount: 0,
      },
      message: generateImmediateResponseMessage(isNewUser, selectedParsingLevel),
    };
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error("Error submitting quick application:", error);
    throw new Error(error.message || "Failed to submit application");
  }
};

// 🚀 UPDATED: BACKGROUND PROCESSING FUNCTION with Dynamic Parsing Level
const processResumeInBackground = async (
  candidateId,
  applicationId,
  resumePath,
  job,
  parsingLevel = 'moderate' // 🚀 NEW: Accept parsing level parameter
) => {
  console.log(`🎯 Starting background CV processing for candidate ${candidateId} with parsing level: ${parsingLevel}`);

  try {
    // Parse resume data with AI first, fallback to manual parser
    let parseResult = {};
    let parseSuccess = false;
    let parsingMethod = "none";
    let actualTokensUsed = 0;

    try {
      console.log(`Background: Starting resume parsing with CV Parser AI (Level: ${parsingLevel})...`);

      // 🚀 NEW: Create CV parser with dynamic parsing level
      const dynamicCVParser = createCVParser(parsingLevel);

      // Try AI parser first with selected parsing level
      parseResult = await dynamicCVParser.parse(resumePath);

      // 🚀 NEW: Get actual token usage information
      const tokenInfo = dynamicCVParser.aiProcessor?.getTokenInfo();
      actualTokensUsed = tokenInfo?.estimatedTokens || 0;

      console.log(`Background: CV Parser AI successful with ${parsingLevel} level:`, {
        confidence: parseResult.metadata?.parseConfidence,
        provider: parseResult.metadata?.provider,
        tokensUsed: actualTokensUsed,
        parsingLevel: parsingLevel
      });

      parseSuccess = true;
      parsingMethod = "ai";
    } catch (aiError) {
      console.warn(
        `Background: CV Parser AI failed with ${parsingLevel} level, attempting manual fallback:`,
        aiError.message,
      );

      try {
        console.log("Background: Starting manual resume parsing...");

        // Fallback to manual parser
        const manualResult = await ResumeParser.parseResume(resumePath);
        console.log("Background: Manual parser successful");

        // Transform manual parser output to match AI format
        parseResult = transformManualToAIFormat(manualResult);
        parseSuccess = true;
        parsingMethod = "manual";
        actualTokensUsed = getParsingLevelInfo('moderate').estimatedTokens; // Estimate for manual parsing
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
      // Update candidate with parsed CV data
      const personal = parseResult.personal || {};
      const totalExperience = calculateTotalExperienceYears(
        parseResult.experience || [],
      );

      const candidate = await Candidate.findByPk(candidateId);

      await candidate.update({
        // Keep existing form data, only add CV-parsed data
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

      // 🚀 NEW: Update application with comprehensive parsing results
      await Application.update(
        {
          parsedResumeData: JSON.stringify({
            parseMetadata: {
              success: parseSuccess,
              method: parsingMethod,
              parsingLevel: parsingLevel,
              actualTokensUsed: actualTokensUsed,
              estimatedTokens: getParsingLevelInfo(parsingLevel).estimatedTokens,
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
              estimatedCost: (actualTokensUsed * 0.0005) / 1000, // Rough cost estimate
              efficiency: parsingMethod === 'ai' ? 'optimal' : 'fallback'
            }
          }),
        },
        { where: { id: applicationId } },
      );

      console.log(
        `Background: CV processing completed successfully for candidate ${candidateId} using ${parsingLevel} level (${actualTokensUsed} tokens)`,
      );

      // 🚀 NEW: Optional notification about processing completion with level info
      await sendCVProcessingCompletionNotification(candidateId, job, {
        parsingLevel,
        tokensUsed: actualTokensUsed,
        confidence: parseResult.metadata?.parseConfidence,
        method: parsingMethod
      });

    } else {
      console.log(
        `Background: CV processing failed for candidate ${candidateId} with ${parsingLevel} level`,
      );

      // Update application to show parsing failed
      await Application.update(
        {
          parsedResumeData: JSON.stringify({
            parseMetadata: {
              success: false,
              method: "failed",
              parsingLevel: parsingLevel,
              actualTokensUsed: 0,
              estimatedTokens: getParsingLevelInfo(parsingLevel).estimatedTokens,
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
              efficiency: 'failed'
            }
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

    // Update application to show processing error
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
            efficiency: 'error'
          }
        }),
      },
      { where: { id: applicationId } },
    );
  }
};

// 🚀 NEW: Helper function for immediate response message with parsing level info
const generateImmediateResponseMessage = (isNewUser, parsingLevel) => {
  const levelInfo = getParsingLevelInfo(parsingLevel);

  const baseMessage = isNewUser
    ? "Application submitted successfully! We've created your account and are processing your resume in the background."
    : "Application submitted successfully! We're processing your resume in the background to update your profile.";

  return `${baseMessage} Using ${parsingLevel} level parsing (${levelInfo.description}) for optimal processing. You'll receive a confirmation email shortly.`;
};

// 🚀 NEW: Send processing completion notification (internal use)
const sendCVProcessingCompletionNotification = async (candidateId, job, parsingInfo) => {
  // This could be used for internal notifications, logging, or analytics
  console.log(`📊 CV Processing Analytics:`, {
    candidateId,
    jobTitle: job.title,
    parsingLevel: parsingInfo.parsingLevel,
    tokensUsed: parsingInfo.tokensUsed,
    confidence: parsingInfo.confidence,
    method: parsingInfo.method,
    timestamp: new Date().toISOString()
  });

  // You could also send this data to analytics services, logs, or admin dashboards
  // await sendAnalyticsEvent('cv_processing_completed', parsingInfo);
};

/**
 * 🚀 NEW: Get parsing analytics for admin dashboard
 */
const getParsingAnalytics = async (filters = {}) => {
  try {
    const whereClause = {};

    if (filters.dateFrom || filters.dateTo) {
      whereClause.appliedAt = {};
      if (filters.dateFrom) {
        whereClause.appliedAt[Op.gte] = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        whereClause.appliedAt[Op.lte] = new Date(filters.dateTo);
      }
    }

    const applications = await Application.findAll({
      where: whereClause,
      attributes: ['id', 'parsingLevel', 'parsedResumeData', 'appliedAt'],
      include: [
        {
          model: Job,
          as: 'job',
          attributes: ['title', 'jobType']
        }
      ]
    });

    // Analyze parsing data
    const analytics = {
      totalApplications: applications.length,
      parsingLevelDistribution: {},
      avgTokensUsed: 0,
      totalTokensUsed: 0,
      parsingSuccessRate: 0,
      costAnalysis: {},
    };

    let totalTokens = 0;
    let successfulParses = 0;

    applications.forEach(app => {
      const level = app.parsingLevel || 'unknown';

      // Count parsing level distribution
      analytics.parsingLevelDistribution[level] = (analytics.parsingLevelDistribution[level] || 0) + 1;

      // Analyze parsed data if available
      if (app.parsedResumeData) {
        try {
          const parsedData = JSON.parse(app.parsedResumeData);
          const metadata = parsedData.parseMetadata || {};

          if (metadata.success) {
            successfulParses++;
          }

          if (metadata.actualTokensUsed) {
            totalTokens += metadata.actualTokensUsed;
          }
        } catch (e) {
          console.warn('Failed to parse application data:', e.message);
        }
      }
    });

    analytics.avgTokensUsed = applications.length > 0 ? Math.round(totalTokens / applications.length) : 0;
    analytics.totalTokensUsed = totalTokens;
    analytics.parsingSuccessRate = applications.length > 0 ? Math.round((successfulParses / applications.length) * 100) : 0;

    // Calculate cost analysis
    Object.keys(analytics.parsingLevelDistribution).forEach(level => {
      const count = analytics.parsingLevelDistribution[level];
      const levelInfo = getParsingLevelInfo(level);
      analytics.costAnalysis[level] = {
        applications: count,
        estimatedCost: (count * levelInfo.estimatedTokens * 0.0005) / 1000,
        description: levelInfo.description
      };
    });

    return analytics;
  } catch (error) {
    console.error('Error getting parsing analytics:', error);
    throw new Error('Failed to get parsing analytics');
  }
};

/**
 * Check if error is from AI provider (API limits, network, etc.)
 */
function isAIProviderError(error) {
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
      parseConfidence: 0.7, // Default confidence for manual parsing
      provider: "manual",
      model: "manual-parser",
      keywords: [],
    },
  };
}

/**
 * Generate appropriate response message based on parsing method
 */
function generateResponseMessage(isNewUser, parsingMethod, confidence) {
  const baseMessage = isNewUser
    ? "Application submitted successfully! Check your email for login credentials."
    : "Application submitted successfully! Your profile has been updated.";

  switch (parsingMethod) {
    case "ai":
      return `${baseMessage} We extracted your information from the resume using AI with ${Math.round(confidence * 100)}% confidence.`;

    case "manual":
      return `${baseMessage} We extracted your information from the resume using our backup parser.`;

    case "failed":
      return `${baseMessage} We couldn't parse your resume automatically, but your application was submitted with the provided information.`;

    case "no_file":
      return `${baseMessage}`;

    default:
      return baseMessage;
  }
}

/**
 * Transform CV Parser AI result to your existing data format
 */
function transformParsedData(cvParserResult) {
  // Extract data from CV Parser AI format and map to your existing format
  const personal = cvParserResult.personal || {};
  const experience = cvParserResult.experience || [];
  const education = cvParserResult.education || [];
  const skills = cvParserResult.skills || {};
  const metadata = cvParserResult.metadata || {};
  /* eslint-disable */

  // Calculate total experience from experience array
  const totalExperience = calculateTotalExperience(experience);

  // Get current job title from most recent experience
  const currentJobTitle = experience.length > 0 ? experience[0].jobTitle : null;

  // Extract location from personal info or most recent experience
  const currentLocation =
    personal.address ||
    personal.city ||
    (experience.length > 0 ? experience[0].location : null);

  // Combine technical and soft skills
  const allSkills = [
    ...(skills.technical || []),
    ...(skills.soft || []),
    ...(skills.frameworks || []),
    ...(skills.tools || []),
  ];

  return {
    // Personal Information
    firstName: personal.firstName || null,
    lastName: personal.lastName || null,
    phone: personal.phone || null,
    currentLocation: currentLocation,
    city: personal.city || null,
    country: personal.country || null,

    // Professional Information
    professionalSummary:
      cvParserResult.summary || cvParserResult.objective || null,
    totalExperience: totalExperience,
    currentJobTitle: currentJobTitle,
    expectedSalary: null, // CV Parser AI doesn't extract this yet
    workMode: null, // CV Parser AI doesn't extract this yet
    jobType: null, // CV Parser AI doesn't extract this yet

    // Structured Data
    skills: allSkills,
    education: education.map((edu) => ({
      institution: edu.institution,
      degree: edu.degree,
      fieldOfStudy: edu.fieldOfStudy,
      startDate: edu.startDate,
      endDate: edu.endDate,
      gpa: edu.gpa,
    })),
    experience: experience.map((exp) => ({
      jobTitle: exp.jobTitle,
      company: exp.company,
      startDate: exp.startDate,
      endDate: exp.endDate,
      location: exp.location,
      description: exp.description,
      technologies: exp.technologies || [],
    })),

    // Metadata
    confidence: metadata.parseConfidence || 0,
    provider: metadata.provider || "cv-parser-ai",
    keywords: metadata.keywords || [],
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
 * Fallback empty data structure
 */
function getEmptyParsedData() {
  return {
    firstName: null,
    lastName: null,
    phone: null,
    currentLocation: null,
    city: null,
    country: null,
    professionalSummary: null,
    totalExperience: null,
    currentJobTitle: null,
    expectedSalary: null,
    workMode: null,
    jobType: null,
    skills: [],
    education: [],
    experience: [],
    confidence: 0,
    provider: "fallback",
    keywords: [],
  };
}

const getApplicationWithResume = async (applicationId) => {
  const application = await Application.findByPk(applicationId, {
    include: [
      {
        model: Candidate,
        attributes: ["firstName", "lastName", "resumePath"],
        include: [
          {
            model: User,
            attributes: ["email"],
          },
        ],
      },
    ],
  });

  return application;
};

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Add dynamic parsing level selection function", "status": "completed", "activeForm": "Adding dynamic parsing level selection function"}, {"content": "Update background processing with dynamic parsing", "status": "completed", "activeForm": "Updating background processing with dynamic parsing"}, {"content": "Add parsing level tracking to application data", "status": "completed", "activeForm": "Adding parsing level tracking to application data"}, {"content": "Create complete updated file", "status": "in_progress", "activeForm": "Creating complete updated file"}]