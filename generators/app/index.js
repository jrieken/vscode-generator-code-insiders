/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';

let Generator = require('yeoman-generator');
let yosay = require('yosay');

let path = require('path');
let validator = require('./validator');
let env = require('./env');
let chalk = require('chalk');

module.exports = class extends Generator {

    constructor(args, opts) {
        super(args, opts);

        this.extensionConfig = Object.create(null);
        this.extensionConfig.installDependencies = false;

        this.abort = false;
    }

    async initializing() {

        // Welcome
        this.log(yosay('Welcome to the Visual Studio Code Insiders Extension generator!'));

        // evaluateEngineVersion
        const dependencyVersions = await env.getDependencyVersions();
        this.extensionConfig.dep = function (name) {
            const version = dependencyVersions[name];
            if (typeof version === 'undefined') {
                throw new Error(`Module ${name} is not listed in env.js`);
            }
            return `${JSON.stringify(name)}: ${JSON.stringify(version)}`;
        };
        this.extensionConfig.vsCodeEngine = await env.getLatestVSCodeVersion();
    }

    prompting() {
        let generator = this;
        let prompts = {
            // Ask for extension type
            askForType: () => {
                const choices = [
                    {
                        name: 'New Web Extension (TypeScript)',
                        value: 'ext-command-web'
                    },
                    {
                        name: 'New Notebook Renderer (TypeScript)',
                        value: 'ext-notebook-renderer'
                    },
                ];

                return generator.prompt({
                    type: 'list',
                    name: 'type',
                    message: 'What type of extension do you want to create?',
                    pageSize: choices.length,
                    choices,
                }).then(typeAnswer => {
                    generator.extensionConfig.type = typeAnswer.type;
                });
            },

            // Ask for extension display name ("displayName" in package.json)
            askForExtensionDisplayName: () => {
                return generator.prompt({
                    type: 'input',
                    name: 'displayName',
                    message: 'What\'s the name of your extension?',
                    default: generator.extensionConfig.displayName
                }).then(displayNameAnswer => {
                    generator.extensionConfig.displayName = displayNameAnswer.displayName;
                });
            },

            // Ask for extension id ("name" in package.json)
            askForExtensionId: () => {
                let def = generator.extensionConfig.name;
                if (!def && generator.extensionConfig.displayName) {
                    def = generator.extensionConfig.displayName.toLowerCase().replace(/[^a-z0-9]/g, '-');
                }
                if (!def) {
                    def = '';
                }

                return generator.prompt({
                    type: 'input',
                    name: 'name',
                    message: 'What\'s the identifier of your extension?',
                    default: def,
                    validate: validator.validateExtensionId
                }).then(nameAnswer => {
                    generator.extensionConfig.name = nameAnswer.name;
                });
            },

            // Ask for extension description
            askForExtensionDescription: () => {
                return generator.prompt({
                    type: 'input',
                    name: 'description',
                    message: 'What\'s the description of your extension?'
                }).then(descriptionAnswer => {
                    generator.extensionConfig.description = descriptionAnswer.description;
                });
            },

            askForGit: () => {
                if (['ext-command-web', 'ext-notebook-renderer'].indexOf(generator.extensionConfig.type) === -1) {
                    return Promise.resolve();
                }

                return generator.prompt({
                    type: 'confirm',
                    name: 'gitInit',
                    message: 'Initialize a git repository?',
                    default: true
                }).then(gitAnswer => {
                    generator.extensionConfig.gitInit = gitAnswer.gitInit;
                });
            },

            askForNotebookRendererInfo: async () => {
                if (generator.extensionConfig.type !== 'ext-notebook-renderer') {
                    return;
                }

                const answers = await generator.prompt([
                    {
                        type: 'input',
                        name: 'rendererId',
                        message: 'What\'s the ID for your renderer?',
                        default: generator.extensionConfig.name
                    },
                    {
                        type: 'input',
                        name: 'rendererDisplayName',
                        message: 'What\'s your renderer display name?',
                        default: generator.extensionConfig.displayName
                    },
                    {
                        type: 'input',
                        name: 'rendererMimeTypes',
                        message: 'What mime types will your renderer handle? (separate multiple by commas)',
                        default: 'application/json',
                    },
                    {
                        type: 'confirm',
                        name: 'includeContentProvider',
                        message: 'Should we generate a test notebook content provider and kernel?',
                        default: false,
                    },
                    {
                        type: 'input',
                        name: 'contentProviderFileType',
                        message: 'What the file extension should the content provider handle?',
                        default: '.sample-json-notebook',
                        // @ts-ignore
                        when: answers => answers.includeContentProvider,
                        validate: answer => answer.startsWith('.') ? true : 'Extension should be given in the form ".ext"',
                    },
                ]);

                answers.rendererMimeTypes = answers.rendererMimeTypes.split(/,\s*/g);
                Object.assign(generator.extensionConfig, answers);
            },

            askForPackageManager: () => {
                if (!['ext-command-web', 'ext-notebook-renderer'].includes(generator.extensionConfig.type)) {
                    return Promise.resolve();
                }
                generator.extensionConfig.pkgManager = 'npm';
                return generator.prompt({
                    type: 'list',
                    name: 'pkgManager',
                    message: 'Which package manager to use?',
                    choices: [
                        {
                            name: 'npm',
                            value: 'npm'
                        },
                        {
                            name: 'yarn',
                            value: 'yarn'
                        }
                    ]
                }).then(pckgManagerAnswer => {
                    generator.extensionConfig.pkgManager = pckgManagerAnswer.pkgManager;
                });
            },
        };

        // run all prompts in sequence. Results can be ignored.
        let result = Promise.resolve();
        for (let taskName in prompts) {
            let prompt = prompts[taskName];
            result = result.then(_ => {
                if (!this.abort) {
                    return new Promise((s, r) => {
                        setTimeout(_ => prompt().then(s, r), 0); // set timeout is required, otherwise node hangs
                    });
                }
            }, error => {
                generator.log(error.toString());
                this.abort = true;
            })
        }
        return result;
    }
    // Write files
    writing() {
        if (this.abort) {
            return;
        }
        this.sourceRoot(path.join(__dirname, './templates/' + this.extensionConfig.type));

        switch (this.extensionConfig.type) {
            case 'ext-command-web':
                this._writingCommandWeb();
                break;
            case 'ext-notebook-renderer':
                this._writingNotebookRenderer();
                break;


            default:
                //unknown project type
                break;
        }
    }

    // Write Notebook Renderer Extension
    _writingNotebookRenderer() {
        let context = this.extensionConfig;

        this.fs.copy(this.sourceRoot() + '/src', context.name + '/src');
        this.fs.copy(this.sourceRoot() + '/vscode', context.name + '/.vscode');
        this.fs.copy(this.sourceRoot() + '/tsconfig.json', context.name + '/tsconfig.json');
        this.fs.copy(this.sourceRoot() + '/.vscodeignore', context.name + '/.vscodeignore');
        this.fs.copy(this.sourceRoot() + '/webpack.config.js', context.name + '/webpack.config.js');
        this.fs.copy(this.sourceRoot() + '/.eslintrc.json', context.name + '/.eslintrc.json');
        this.fs.copy(this.sourceRoot() + '/src/extension/types/.gitkeep', context.name + '/src/extension/types/.gitkeep');
        this.fs.copy(this.sourceRoot() + '/src/extension/types/.gitkeep', context.name + '/src/test/types/.gitkeep');

        this.fs.copyTpl(this.sourceRoot() + '/package.json', context.name + '/package.json', context);
        this.fs.copyTpl(this.sourceRoot() + '/README.md', context.name + '/README.md', context);
        this.fs.copyTpl(this.sourceRoot() + '/src/client/index.ts', context.name + '/src/client/index.ts', context);

        this.fs.copyTpl(this.sourceRoot() + '/src/extension/extension.ts', context.name + '/src/extension/extension.ts', context);

        if (!this.extensionConfig.includeContentProvider) {
            this.fs.delete(context.name + '/src/extension/testProvider.ts');
        }

        if (this.extensionConfig.gitInit) {
            this.fs.copy(this.sourceRoot() + '/gitignore', context.name + '/.gitignore');
            this.fs.copy(this.sourceRoot() + '/gitattributes', context.name + '/.gitattributes');
        }

        this.extensionConfig.installDependencies = true;
    }

    // Write Command Extension (TypeScript)
    _writingCommandWeb() {
        let context = this.extensionConfig;

        this.fs.copy(this.sourceRoot() + '/vscode', context.name + '/.vscode');
        this.fs.copy(this.sourceRoot() + '/src/test', context.name + '/src/test');

        this.fs.copy(this.sourceRoot() + '/vscodeignore', context.name + '/.vscodeignore');
        if (this.extensionConfig.gitInit) {
            this.fs.copy(this.sourceRoot() + '/gitignore', context.name + '/.gitignore');
        }
        this.fs.copyTpl(this.sourceRoot() + '/README.md', context.name + '/README.md', context);
        this.fs.copyTpl(this.sourceRoot() + '/CHANGELOG.md', context.name + '/CHANGELOG.md', context);
        this.fs.copyTpl(this.sourceRoot() + '/vsc-extension-quickstart.md', context.name + '/vsc-extension-quickstart.md', context);
        this.fs.copyTpl(this.sourceRoot() + '/tsconfig.json', context.name + '/tsconfig.json', context);

        this.fs.copyTpl(this.sourceRoot() + '/src/node/extension.ts', context.name + '/src/node/extension.ts', context);
        this.fs.copyTpl(this.sourceRoot() + '/src/web/extension.ts', context.name + '/src/web/extension.ts', context);

        this.fs.copyTpl(this.sourceRoot() + '/build/node-extension.webpack.config.js', context.name + '/build/node-extension.webpack.config.js', context);
        this.fs.copyTpl(this.sourceRoot() + '/build/web-extension.webpack.config.js', context.name + '/build/web-extension.webpack.config.js', context);
        this.fs.copyTpl(this.sourceRoot() + '/package.json', context.name + '/package.json', context);

        this.fs.copy(this.sourceRoot() + '/.eslintrc.json', context.name + '/.eslintrc.json');

        this.extensionConfig.installDependencies = true;
    }

    // Installation
    install() {
        if (this.abort) {
            return;
        }
        process.chdir(this.extensionConfig.name);

        if (this.extensionConfig.installDependencies) {
            this.installDependencies({
                yarn: this.extensionConfig.pkgManager === 'yarn',
                npm: this.extensionConfig.pkgManager === 'npm',
                bower: false
            });
        }
    }

    // End
    end() {
        if (this.abort) {
            return;
        }


        // Git init
        if (this.extensionConfig.gitInit) {
            this.spawnCommand('git', ['init', '--quiet']);
        }

        this.log('');
        this.log('Your extension ' + this.extensionConfig.name + ' has been created!');
        this.log('');
        this.log('To start editing with Visual Studio Code, use the following commands:');
        this.log('');
        this.log('     cd ' + this.extensionConfig.name);
        this.log('     code-insiders .');
        this.log('');
        this.log('Open vsc-extension-quickstart.md inside the new extension for further instructions');
        this.log('on how to modify and test your extension.');
        this.log('');

        if (this.extensionConfig.type === 'ext-extensionpack') {
            this.log(chalk.yellow('Please review the "extensionPack" in the "package.json" before publishing the extension pack.'));
            this.log('');
        }

        this.log('For more information, also visit http://code.visualstudio.com and follow us @code.');
        this.log('\r\n');
    }
}
