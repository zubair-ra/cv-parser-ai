"use strict";

const {
  FIELD_TYPES
} = require('./fieldTypes');

/**
 * Flexible CV Schema System
 * Developers can define what fields they want to extract
 */

class CVSchema {
  constructor(schemaDefinition = {}) {
    this.schema = {
      ...this.getDefaultSchema(),
      ...schemaDefinition
    };
    this.validateSchema();
  }

  /**
   * Default comprehensive schema
   */
  getDefaultSchema() {
    return {
      // Personal Information
      personal: {
        type: FIELD_TYPES.OBJECT,
        required: true,
        fields: {
          fullName: {
            type: FIELD_TYPES.NAME,
            required: true
          },
          firstName: {
            type: FIELD_TYPES.STRING,
            required: false
          },
          lastName: {
            type: FIELD_TYPES.STRING,
            required: false
          },
          email: {
            type: FIELD_TYPES.EMAIL,
            required: true
          },
          phone: {
            type: FIELD_TYPES.PHONE,
            required: false
          },
          address: {
            type: FIELD_TYPES.ADDRESS,
            required: false
          },
          city: {
            type: FIELD_TYPES.STRING,
            required: false
          },
          state: {
            type: FIELD_TYPES.STRING,
            required: false
          },
          country: {
            type: FIELD_TYPES.STRING,
            required: false
          },
          postalCode: {
            type: FIELD_TYPES.STRING,
            required: false
          },
          linkedIn: {
            type: FIELD_TYPES.URL,
            required: false
          },
          github: {
            type: FIELD_TYPES.URL,
            required: false
          },
          website: {
            type: FIELD_TYPES.URL,
            required: false
          }
        }
      },
      // Work Experience
      experience: {
        type: FIELD_TYPES.ARRAY,
        required: false,
        itemType: FIELD_TYPES.EXPERIENCE,
        fields: {
          jobTitle: {
            type: FIELD_TYPES.STRING,
            required: true
          },
          company: {
            type: FIELD_TYPES.STRING,
            required: true
          },
          startDate: {
            type: FIELD_TYPES.DATE,
            required: false
          },
          endDate: {
            type: FIELD_TYPES.DATE,
            required: false
          },
          current: {
            type: FIELD_TYPES.BOOLEAN,
            required: false
          },
          duration: {
            type: FIELD_TYPES.STRING,
            required: false
          },
          location: {
            type: FIELD_TYPES.STRING,
            required: false
          },
          description: {
            type: FIELD_TYPES.STRING,
            required: false
          },
          achievements: {
            type: FIELD_TYPES.ARRAY,
            required: false
          },
          technologies: {
            type: FIELD_TYPES.SKILL_LIST,
            required: false
          }
        }
      },
      // Education
      education: {
        type: FIELD_TYPES.ARRAY,
        required: false,
        itemType: FIELD_TYPES.EDUCATION,
        fields: {
          institution: {
            type: FIELD_TYPES.STRING,
            required: true
          },
          degree: {
            type: FIELD_TYPES.STRING,
            required: true
          },
          fieldOfStudy: {
            type: FIELD_TYPES.STRING,
            required: false
          },
          startDate: {
            type: FIELD_TYPES.DATE,
            required: false
          },
          endDate: {
            type: FIELD_TYPES.DATE,
            required: false
          },
          gpa: {
            type: FIELD_TYPES.STRING,
            required: false
          },
          location: {
            type: FIELD_TYPES.STRING,
            required: false
          },
          achievements: {
            type: FIELD_TYPES.ARRAY,
            required: false
          }
        }
      },
      // Skills
      skills: {
        type: FIELD_TYPES.OBJECT,
        required: false,
        fields: {
          technical: {
            type: FIELD_TYPES.SKILL_LIST,
            required: false
          },
          soft: {
            type: FIELD_TYPES.SKILL_LIST,
            required: false
          },
          languages: {
            type: FIELD_TYPES.ARRAY,
            required: false
          },
          frameworks: {
            type: FIELD_TYPES.SKILL_LIST,
            required: false
          },
          tools: {
            type: FIELD_TYPES.SKILL_LIST,
            required: false
          },
          databases: {
            type: FIELD_TYPES.SKILL_LIST,
            required: false
          }
        }
      },
      // Certifications
      certifications: {
        type: FIELD_TYPES.ARRAY,
        required: false,
        itemType: FIELD_TYPES.CERTIFICATION,
        fields: {
          name: {
            type: FIELD_TYPES.STRING,
            required: true
          },
          issuer: {
            type: FIELD_TYPES.STRING,
            required: true
          },
          issueDate: {
            type: FIELD_TYPES.DATE,
            required: false
          },
          expiryDate: {
            type: FIELD_TYPES.DATE,
            required: false
          },
          credentialId: {
            type: FIELD_TYPES.STRING,
            required: false
          },
          url: {
            type: FIELD_TYPES.URL,
            required: false
          }
        }
      },
      // Additional sections
      summary: {
        type: FIELD_TYPES.STRING,
        required: false
      },
      objective: {
        type: FIELD_TYPES.STRING,
        required: false
      },
      projects: {
        type: FIELD_TYPES.ARRAY,
        required: false,
        fields: {
          name: {
            type: FIELD_TYPES.STRING,
            required: true
          },
          description: {
            type: FIELD_TYPES.STRING,
            required: false
          },
          technologies: {
            type: FIELD_TYPES.SKILL_LIST,
            required: false
          },
          url: {
            type: FIELD_TYPES.URL,
            required: false
          }
        }
      },
      // Metadata
      metadata: {
        type: FIELD_TYPES.OBJECT,
        required: false,
        fields: {
          totalExperience: {
            type: FIELD_TYPES.STRING,
            required: false
          },
          keywords: {
            type: FIELD_TYPES.ARRAY,
            required: false
          },
          parseConfidence: {
            type: FIELD_TYPES.NUMBER,
            required: false
          },
          parseDate: {
            type: FIELD_TYPES.DATE,
            required: false
          }
        }
      }
    };
  }

  /**
   * Create a custom schema for specific use cases
   */
  static createCustomSchema(fields) {
    return new CVSchema(fields);
  }

  /**
   * Pre-built schemas for common use cases
   */
  static getMinimalSchema() {
    return new CVSchema({
      personal: {
        type: FIELD_TYPES.OBJECT,
        required: true,
        fields: {
          fullName: {
            type: FIELD_TYPES.NAME,
            required: true
          },
          email: {
            type: FIELD_TYPES.EMAIL,
            required: true
          },
          phone: {
            type: FIELD_TYPES.PHONE,
            required: false
          }
        }
      },
      experience: {
        type: FIELD_TYPES.ARRAY,
        required: false,
        fields: {
          jobTitle: {
            type: FIELD_TYPES.STRING,
            required: true
          },
          company: {
            type: FIELD_TYPES.STRING,
            required: true
          }
        }
      }
    });
  }
  static getATSSchema() {
    return new CVSchema({
      personal: {
        type: FIELD_TYPES.OBJECT,
        required: true,
        fields: {
          fullName: {
            type: FIELD_TYPES.NAME,
            required: true
          },
          email: {
            type: FIELD_TYPES.EMAIL,
            required: true
          },
          phone: {
            type: FIELD_TYPES.PHONE,
            required: true
          },
          linkedIn: {
            type: FIELD_TYPES.URL,
            required: false
          }
        }
      },
      experience: {
        type: FIELD_TYPES.ARRAY,
        required: true,
        fields: {
          jobTitle: {
            type: FIELD_TYPES.STRING,
            required: true
          },
          company: {
            type: FIELD_TYPES.STRING,
            required: true
          },
          startDate: {
            type: FIELD_TYPES.DATE,
            required: true
          },
          endDate: {
            type: FIELD_TYPES.DATE,
            required: false
          },
          description: {
            type: FIELD_TYPES.STRING,
            required: true
          }
        }
      },
      skills: {
        type: FIELD_TYPES.OBJECT,
        required: true,
        fields: {
          technical: {
            type: FIELD_TYPES.SKILL_LIST,
            required: true
          }
        }
      }
    });
  }
  validateSchema() {
    // Add schema validation logic here
    return true;
  }
  getRequiredFields() {
    const required = [];
    this._extractRequiredFields(this.schema, '', required);
    return required;
  }
  _extractRequiredFields(obj, path, required) {
    Object.entries(obj).forEach(([key, config]) => {
      const currentPath = path ? `${path}.${key}` : key;
      if (config.required) {
        required.push(currentPath);
      }
      if (config.fields) {
        this._extractRequiredFields(config.fields, currentPath, required);
      }
    });
  }
}
module.exports = CVSchema;