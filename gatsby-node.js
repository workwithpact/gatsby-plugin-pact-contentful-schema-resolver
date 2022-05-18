/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.com/docs/node-apis/
 */
// You can delete this file if you're not using it

/**
 * You can uncomment the following line to verify that
 * your plugin is being loaded in your site.
 *
 * See: https://www.gatsbyjs.com/docs/creating-a-local-plugin/#developing-a-local-plugin-that-is-outside-your-project
 */
exports.onPreInit = () => console.log("Loaded pact-contentful-schema-gatsby")

const knownDefinitions = [];
const knownTypes = {};

exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions
  const typeDefs = `
    type PactSection {
      id: String!
      name: String
      models: [String!]!
      configJson: String
      settings: [PactSectionSetting!]!
      blocks: [PactSectionBlock!]
    }

    type PactSectionBlock {
      name: String
      type: String!
      settings: [PactSectionSetting!]!
      index: Int!
    }
    
    union PactSectionSetting = PactSectionSettingNumber | PactSectionSettingString | PactSectionSettingBoolean | PactSectionSettingNode

    interface PactSectionSettingDefault {
      id: String!
    }

    type PactSectionSettingNumber implements PactSectionSettingDefault {
      id: String!
      value: Float
    }

    type PactSectionSettingString implements PactSectionSettingDefault {
      id: String!
      value: String
    }

    type PactSectionSettingBoolean implements PactSectionSettingDefault {
      id: String!
      value: Boolean
    }

    type PactSectionSettingNode implements PactSectionSettingDefault {
      id: String!
      value: ContentfulEntry
    }

    type PactSectionSettingAsset implements PactSectionSettingDefault {
      id: String!
      value: ContentfulAsset
    }
  `
  createTypes(typeDefs)
}



exports.createResolvers = ({ createResolvers, intermediateSchema }, pluginOptions) => {
  let knownDefinitions = null;
  const seenDefinitions = {};
  const contentfulTypes = Object.keys(intermediateSchema._typeMap)
    .filter(type => type.startsWith('Contentful') && type.endsWith('Sys'))
    .map(type => type.substring(0, type.length - 3).split('SysContentType').shift() + '')
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .filter(v => !intermediateSchema._implementationsMap[v]) //&& intermediateSchema._typeMap[`${v}Fields`])

  const resolvers = {
    PactSection: {
      setting: {
        resolve(source, args, context, info) {
          const { id } = args;
          const { settings } = source;
          return settings.find(setting => setting.id === id);
        },
        type: 'PactSectionSetting',
        args: {
          id: {
            type: 'String!',
            description: 'The id of the setting to retrieve',
          },
        }
      },
      settingAsText: {
        resolve(source, args, context, info) {
          const { id } = args;
          const { settings } = source;
          const value = settings.find(setting => setting.id === id)
          return typeof value !== 'undefined' && value !== null ? value : null;
        },
        type: 'PactSectionSettingString',
        args: {
          id: {
            type: 'String!',
            description: 'The id of the setting to retrieve',
          },
        }
      },
      settingAsBoolean: {
        resolve(source, args, context, info) {
          const { id } = args;
          const { settings } = source;
          const value = settings.find(setting => setting.id === id)
          return typeof value !== 'undefined' && value !== null ? !!value : null;
        },
        type: 'PactSectionSettingBoolean',
        args: {
          id: {
            type: 'String!',
            description: 'The id of the setting to retrieve',
          },
        }
      },
      settingAsNumber: {
        resolve(source, args, context, info) {
          const { id } = args;
          const { settings } = source;
          const value = settings.find(setting => setting.id === id)
          return typeof value !== 'undefined' && value !== null ? parseFloat(value) : null;
        },
        type: 'PactSectionSettingNumber',
        args: {
          id: {
            type: 'String!',
            description: 'The id of the setting to retrieve',
          },
        }
      },
      settingAsNode: {
        resolve(source, args, context, info) {
          const { id } = args;
          const { settings } = source;
          const value = settings.find(setting => setting.id === id)
          return typeof value !== 'undefined' && value !== null ? value : null;
        },
        type: 'PactSectionSettingNode',
        args: {
          id: {
            type: 'String!',
            description: 'The id of the setting to retrieve',
          },
        }
      },
    }
  };

  const getAllSections = async (source, context) => {
    if (knownDefinitions === null) {
      const definitions = await context.nodeModel.findAll({ type: "ContentfulPactSectionsDefinitions"});
      knownDefinitions = [];
      for(const def of definitions.entries) {
        const { title, models, id } = def;
        if (seenDefinitions[id]) {
          continue;
        }
        const config = def.config___NODE ? await context.nodeModel.getNodeById({ id: def.config___NODE }) : null;
        knownDefinitions.push({
          title,
          models,
          config,
          id
        });
        seenDefinitions[id] = true;
      }
    }
    const matchingDefinitions = knownDefinitions.filter(def => {
      return def.models.find((model) => {
        const [type, field] = `${model}`.split(':');
        return ['*', source?.sys?.contentType?.sys?.id].includes(type) && source && source[`${field}___NODE`]
      });
    })
    const returnValues = [];
    for(const def of matchingDefinitions) {
      const { title, models, config, id } = def;
      const model = def.models.find((model) => {
        const [type, field] = `${model}`.split(':');
        return ['*', source?.sys?.contentType?.sys?.id].includes(type) && source && source[`${field}___NODE`]
      });
      const [type, field] = `${model}`.split(':');
      const fieldValue = await context.nodeModel.getNodeById({ id: source[`${field}___NODE`] });

      const section = {
        id: field,
        name: def.title,
        models: def.models,
        configJson: def?.config?.internal?.content || '{}',
        settings: [],
        blocks: []
      }
      const originalFieldValue = JSON.parse(fieldValue?.internal?.content || '{}');
      const entries = Object.entries(originalFieldValue?.settings || {})

      for(const [key, value] of entries) {
        let type = 'PactSectionSettingNode'
        const matchingSetting = (config?.settings || []).find(setting => setting.id === key);
        switch(matchingSetting?.type) {
          case 'number':
          case 'range':
            type = 'PactSectionSettingNumber';
            break;
          case 'checkbox':
            type = 'PactSectionSettingBoolean';
            break;
          case 'text':
          case 'textarea':
          case 'richtext':
          case 'select':
          case 'radio':
          case 'url':
          case 'email':
          case 'search':
          case 'password':
          case 'tel':
          case 'date':
          case 'time':
          case 'datetime':
          case 'color':
            type = 'PactSectionSettingString';
            break;
        }
        let finalValue = value;
        if (type === 'PactSectionSettingNode' || type === 'PactSectionSettingAsset') {
          finalValue = await context.nodeModel.getNodeById({ id: value });
        } else if (type === 'PactSectionSettingBoolean') {
          finalValue = !!value
        } 
        else if(type === 'PactSectionSettingNumber') {
          finalValue = parseFloat(value)
        }
        const currentSetting = {
          id: key,
          value: finalValue,
          internal: {
            type
          }
        }
        section.settings.push(currentSetting);
      }
      returnValues.push(section);
    }

    return returnValues;
  }

  contentfulTypes.forEach(type => {
    resolvers[type] = {
      section: {
        type: 'PactSection',
        args: {
          id: "String!"
        },
        resolve: async (source, args, context, info) => {
          const allSections = await getAllSections(source, context);
          return (allSections || []).find(v => v.id === args.id)
        }
      },
      sections: {
        type: [`PactSection`],
        resolve: async (source, args, context, info) => {
          return await getAllSections(source, context);
        },
      }
    }
  });
  createResolvers(resolvers);
};

