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
  const sectionDefinitionTypes = ['ContentfulPactSectionsDefinitions', 'ContentfulCustomFieldDefinitions'];
  const sectionDefinitionType = sectionDefinitionTypes.find(type => contentfulTypes.includes(type));
  if (!sectionDefinitionType) {
    console.error(`No section definition type found. Expected one of ${sectionDefinitionTypes.join(', ')}`);
  }

  const settingResolvers = {
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
    settingValueAsText: {
      resolve(source, args, context, info) {
        const { id } = args;
        const { settings } = source;
        const settingValue = settings.find(setting => setting.id === id)
        const value = settingValue && typeof settingValue.value !== 'undefined' && settingValue.value !== null ? `${settingValue.value}` : null;
        return value
      },
      type: 'String',
      args: {
        id: {
          type: 'String!',
          description: 'The id of the setting to retrieve',
        },
      }
    },
    settingValueAsBoolean: {
      resolve(source, args, context, info) {
        const { id } = args;
        const { settings } = source;
        const settingValue = settings.find(setting => setting.id === id)
        const value = settingValue && typeof settingValue.value !== 'undefined' && settingValue.value !== null ? !!settingValue.value : null;
        return value
      },
      type: 'Boolean',
      args: {
        id: {
          type: 'String!',
          description: 'The id of the setting to retrieve',
        },
      }
    },
    settingValueAsNumber: {
      resolve(source, args, context, info) {
        const { id } = args;
        const { settings } = source;
        const settingValue = settings.find(setting => setting.id === id)
        const value = settingValue && typeof settingValue.value !== 'undefined' && settingValue.value !== null ? parseFloat(settingValue.value) : null;
        return isNaN(value) ? null : value
      },
      type: 'PactSectionSettingNumber',
      args: {
        id: {
          type: 'String!',
          description: 'The id of the setting to retrieve',
        },
      }
    },
    settingValueAsNode: {
      resolve(source, args, context, info) {
        const { id } = args;
        const { settings } = source;
        const settingValue = settings.find(setting => setting.id === id)
        const value = settingValue && typeof settingValue.value !== 'undefined' && settingValue.value !== null ? settingValue.value : null;
        return value;
      },
      type: 'ContentfulEntry',
      args: {
        id: {
          type: 'String!',
          description: 'The id of the setting to retrieve',
        },
      }
    },
    settingValueAsAsset: {
      resolve(source, args, context, info) {
        const { id } = args;
        const { settings } = source;
        const settingValue = settings.find(setting => setting.id === id)
        const value = settingValue && typeof settingValue.value !== 'undefined' && settingValue.value !== null ? settingValue.value : null;
        return value;
      },
      type: 'ContentfulAsset',
      args: {
        id: {
          type: 'String!',
          description: 'The id of the setting to retrieve',
        },
      }
    }
  }
  contentfulTypes.forEach(type => {
    const resolverName = `settingValueAs${type}`;
    settingResolvers[resolverName] = {
      async resolve(source, args, context, info) {
        const { id } = args;
        const { settings } = source;
        const settingValue = settings.find(setting => setting.id === id)
        const value = settingValue && typeof settingValue.value !== 'undefined' && settingValue.value !== null ? settingValue.value : null;
        if (value?.contentful_id) {
          return await context.nodeModel.findOne(
            { 
              type,
              query: {
                filter: {
                  contentful_id: {
                    eq: value.contentful_id
                  }
                }
              }
            });
        }
        return null;
      },
      type,
      args: {
        id: {
          type: 'String!',
          description: 'The id of the setting to retrieve',
        },
      }
    };
  });

  const resolvers = {
    PactSectionBlock: {
      ...settingResolvers
    },
    PactSection: {
      ...settingResolvers,
      blocksOfType: {
        resolve(source, args, context, info) {
          const matchingBlocks = source.blocks.filter(block => {
            return block && block.type === args.type
          })
          return matchingBlocks
        },
        type: ['PactSectionBlock'],
        args: {
          type: {
            type: 'String!',
            description: 'The type of block to filter by',
          }
        }
      },
    }
  };

  const buildSettingValue = async ({ key, value, config, context}) => {
    let type = 'PactSectionSettingNode'
    switch(config?.type) {
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
      case 'image_picker':
      case 'asset':
        type = 'PactSectionSettingAsset';
        break;
      default:
        type = 'PactSectionSettingNode';
    }
    let finalValue = value;

    if (type === 'PactSectionSettingNode' || type === 'PactSectionSettingAsset') {
      const contentfulId = `${value}`.split('/').pop() || 'BOGUS'
      finalValue = await context.nodeModel.findOne({ type: type === 'PactSectionSettingAsset' ? 'ContentfulAsset' : 'ContentfulEntry', query: {
        filter: {
          contentful_id: {
            eq: contentfulId
          }
        }
      } });
    } else if (type === 'PactSectionSettingBoolean') {
      finalValue = !!finalValue
    } 
    else if(type === 'PactSectionSettingNumber') {
      finalValue = parseFloat(finalValue)
    }
    return {
      id: key,
      value: finalValue,
      internal: {
        type
      }
    }
  }

  const getAllSections = async (source, context) => {
    if (knownDefinitions === null) {
      const definitions = await context.nodeModel.findAll({ type: sectionDefinitionType});
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
      const matchingModels = def.models.filter((model) => {
        const [type, field] = `${model}`.split(':');
        return ['*', source?.sys?.contentType?.sys?.id].includes(type) && source && source[`${field}___NODE`]
      });
      for(const model of matchingModels) {
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
        const settings = (config?.settings || []).filter(setting => setting.id)
        for (const setting of settings) {
          const originalValue = (originalFieldValue?.settings || {})[setting.id];
          const value = typeof originalValue === 'undefined' || originalValue === null ? setting.default || null : originalValue;
          const currentSetting = await buildSettingValue({context, key: setting.id, value, config: setting});
          section.settings.push(currentSetting);
        }

        let blockIndex = 0;
        for(const block of originalFieldValue?.blocks || []) {
          const matchingBlockConfig = config?.blocks?.find(b => b && block && b.type === block.type);
          const currentBlock = {
            type: block.type || null,
            name: matchingBlockConfig?.name || 'Unknown',
            settings: [],
            index: blockIndex
          }

          for(const matchingSetting of (matchingBlockConfig?.settings || []).filter(s => s.id)) {
            const originalValue = (block.settings || {})[matchingSetting.id];
            const value = typeof originalValue === 'undefined' || originalValue === null ? matchingSetting.default || null : originalValue;
            const currentSetting = await buildSettingValue({context, key: matchingSetting.id, value, config: matchingSetting});
            currentBlock.settings.push(currentSetting);
          }

          section.blocks.push(currentBlock)
          ++blockIndex;
        }

        returnValues.push(section);
      }
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

