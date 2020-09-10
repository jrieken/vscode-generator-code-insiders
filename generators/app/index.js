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
        this.extensionConfig.dependencyVersions = dependencyVersions;
        this.extensionConfig.dep = function (name) {
            const version = dependencyVersions[name];
            if (typeof version === 'undefined') {
                throw new Error(`Module ${name} is not listed in env.js`);
            }
            return `${JSON.stringify(name)}: ${JSON.stringify(version)}`;
        };
        this.extensionConfig.vsCodeEngine = await env.getLatestVSCodeVersion();
    }

    async prompting() {
        let generator = this;


        async function getPrompts() {

            const choices = [
                {
                    name: 'New Web Extension (TypeScript)',
                    value: 'ext-command-web'
                },
                {
                    name: 'New Notebook Renderer (TypeScript)',
                    value: 'ext-notebook-renderer'
                },
                {
                    name: 'Add Web bits to existing extension (TypeScript)',
                    value: 'ext-command-web-update'
                },
            ];

            const type = generator.extensionConfig.type = (await generator.prompt({
                type: 'list',
                name: 'type',
                message: 'What type of extension do you want to create?',
                pageSize: choices.length,
                choices,
            })).type;

            switch (type) {
                case 'ext-command-web':
                    return [askForExtensionDisplayName, askForExtensionId, askForExtensionDescription, askForGit, askForPackageManager];
                case 'ext-notebook-renderer':
                    return [askForExtensionDisplayName, askForExtensionId, askForExtensionDescription, askForGit, askForNotebookRendererInfo, askForPackageManager];
                default:
                    return [];
            }
        }

        // Ask for extension display name ("displayName" in package.json)
        async function askForExtensionDisplayName() {
            generator.extensionConfig.displayName = (await generator.prompt({
                type: 'input',
                name: 'displayName',
                message: 'What\'s the name of your extension?',
                default: generator.extensionConfig.displayName
            })).displayName;
        }

        // Ask for extension id ("name" in package.json)
        async function askForExtensionId() {
            let def = generator.extensionConfig.name;
            if (!def && generator.extensionConfig.displayName) {
                def = generator.extensionConfig.displayName.toLowerCase().replace(/[^a-z0-9]/g, '-');
            }
            if (!def) {
                def = '';
            }

            generator.extensionConfig.name = (await generator.prompt({
                type: 'input',
                name: 'name',
                message: 'What\'s the identifier of your extension?',
                default: def,
                validate: validator.validateExtensionId
            })).name;
        }

        // Ask for extension description
        async function askForExtensionDescription() {
            generator.extensionConfig.description = (await generator.prompt({
                type: 'input',
                name: 'description',
                message: 'What\'s the description of your extension?'
            })).description;
        }

        async function askForGit() {
            generator.extensionConfig.gitInit = (await generator.prompt({
                type: 'confirm',
                name: 'gitInit',
                message: 'Initialize a git repository?',
                default: true
            })).gitInit;
        }

        async function askForNotebookRendererInfo() {
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
        }

        async function askForPackageManager() {
            generator.extensionConfig.pkgManager = (await generator.prompt({
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
            })).pkgManager;
        };

        const prompts = await getPrompts();
        for (const prompt of prompts) {
            await prompt();
        }
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
            case 'ext-command-web-update':
                this._writingWebUpdate();
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

    // Write Web Extension (TypeScript)
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

        this.fs.copyTpl(this.sourceRoot() + '/src/web/extension.ts', context.name + '/src/web/extension.ts', context);

        this.fs.copyTpl(this.sourceRoot() + '/build/web-extension.webpack.config.js', context.name + '/build/web-extension.webpack.config.js', context);
        this.fs.copyTpl(this.sourceRoot() + '/package.json', context.name + '/package.json', context);

        this.fs.copy(this.sourceRoot() + '/.eslintrc.json', context.name + '/.eslintrc.json');

        this.extensionConfig.installDependencies = true;
    }

    // Write Command Extension (TypeScript)
    _writingWebUpdate() {
        let context = this.extensionConfig;

        const pkgJSON = this.fs.readJSON(this.destinationPath('package.json'));
        if (!pkgJSON || !pkgJSON.engines || !pkgJSON.engines.vscode) {
            this.log('');
            this.log('Unable to find `package.json` in the current directory.');
            this.log('Please run the generator on the folder on an existing VSCode extension.');
            this.abort = true;
            return;
        }

        this.log('To make this extension a web extension, the generator will add the following:');
        this.log('- A new main module `src/web/extension.ts` used when running in the web extension host.');
        this.log('- New webpack configuration file `build/web-extension.webpack.config.js`');
        this.log('- Updates to `package.json`:');
        this.log('  - new property `browser`: points to the packaged web main module.');
        this.log('  - new devDependencies: `webpack`, `webpack-cli` and `ts-loader`');
        this.log('  - new scripts: `compile-web`, `watch-web` and `package-web`');

        this.extensionConfig.name = pkgJSON.name;
        this.extensionConfig.displayName = pkgJSON.displayName;

        const dependencyVersions = this.extensionConfig.dependencyVersions;

        this.fs.extendJSON('package.json', {
            'browser': './dist/web/extension.js',
            'scripts': {
                "compile-web": "webpack --devtool nosources-source-map --config ./build/web-extension.webpack.config.js",
                "watch-web": "webpack --watch --devtool nosources-source-map --info-verbosity verbose --config ./build/web-extension.webpack.config.js",
                "package-web": "webpack --mode production --config ./build/web-extension.webpack.config.js",
            },
            'devDependencies': {
                'ts-loader': dependencyVersions['ts-loader'],
                'webpack': dependencyVersions['webpack'],
                'webpack-cli': dependencyVersions['webpack-cli']
            }
        });

        this.fs.copyTpl(this.sourceRoot() + '/src/web/extension.ts', 'src/web/extension.ts', context, {});

        this.fs.copyTpl(this.sourceRoot() + '/build/web-extension.webpack.config.js', 'build/web-extension.webpack.config.js', context);

        if (this.fs.exists(this.destinationPath('yarn.lock'))) {
            this.extensionConfig.pkgManager = 'yarn';
        } else {
            this.extensionConfig.pkgManager = 'npm';
        }
        this.extensionConfig.installDependencies = true;
    }

    // Installation
    install() {
        if (this.abort) {
            return;
        }

        if (this.extensionConfig.installDependencies) {
            if (this.extensionConfig.type.indexOf('update') === -1) {
                process.chdir(this.extensionConfig.name);
            }
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

        if (this.extensionConfig.type === 'ext-command-web-update') {
            this.log('');
            this.log('Your extension has been updated!');
            this.log('');
            this.log('To start editing with Visual Studio Code, use the following commands:');
            this.log('');
            this.log('     code-insiders .');
            this.log(`     ${this.extensionConfig.pkgManager} run compile-web`);
            this.log('');
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
