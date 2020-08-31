"use strict";
var path = require('path');
var assert = require('yeoman-assert')
var helpers = require('yeoman-test');

var env = require('../generators/app/env');

var fs = require('fs');


describe('test code generator', function () {
    this.timeout(10000);

    var engineVersion;
    var dependencyVersions;

    before(async function () {
        engineVersion = await env.getLatestVSCodeVersion();
        console.info('    expecting engine version ' + engineVersion);

        dependencyVersions = await env.getDependencyVersions();
    });

    function devDependencies(names) {
        const res = {};
        for (const name of names) {
            res[name] = dependencyVersions[name];
        }
        return res;
    }

    it('command-web', function (done) {
        this.timeout(10000);

        helpers.run(path.join(__dirname, '../generators/app'))
            .withPrompts({
                type: 'ext-command-web',
                name: 'testCom',
                displayName: 'Test Com',
                description: 'My TestCom',
                gitInit: true,
                pkgManager: 'npm'
            }) // Mock the prompt answers
            .toPromise().then(function () {
                var expectedPackageJSON = {
                    "name": "testCom",
                    "displayName": 'Test Com',
                    "description": "My TestCom",
                    "version": "0.0.1",
                    "engines": {
                        "vscode": engineVersion
                    },
                    "activationEvents": [
                        "onCommand:testCom.helloWorld"
                    ],
                    "devDependencies": devDependencies([
                        "@types/vscode",
                        "@types/glob",
                        "@types/mocha",
                        "@types/node",
                        "eslint",
                        "@typescript-eslint/parser",
                        "@typescript-eslint/eslint-plugin",
                        "glob",
                        "mocha",
                        "typescript",
                        "vscode-test",
                        "ts-loader",
                        "webpack",
                        "webpack-cli"
                    ]),
                    "browser": "./dist/web/extension.js",
                    "scripts": {
                        "test": "node ./out/test/runTests.js",
                        "pretest": "tsc -p ./",
                        "vscode:prepublish": "npm run package-web",
                        "compile-web": "webpack --devtool nosources-source-map --config ./build/web-extension.webpack.config.js",
                        "watch-web": "webpack --watch --devtool nosources-source-map --info-verbosity verbose --config ./build/web-extension.webpack.config.js",
                        "package-web": "webpack --mode production --watch --config ./build/web-extension.webpack.config.js",
                        "lint": "eslint src --ext ts"
                    },
                    "categories": [
                        "Other"
                    ],
                    "contributes": {
                        "commands": [{
                            "command": "testCom.helloWorld",
                            "title": "Hello World"
                        }]
                    }
                };
                try {


                    assert.file(['package.json', 'README.md', 'CHANGELOG.md', '.vscodeignore', 'src/web/extension.ts', 'build/web-extension.webpack.config.js', 'src/test/suite/extension.test.ts', 'src/test/suite/index.ts', 'tsconfig.json']);

                    var packageJSONBody = fs.readFileSync('package.json', 'utf8')
                    var actualPackageJSON = JSON.parse(packageJSONBody);
                    assert.deepEqual(expectedPackageJSON, actualPackageJSON);

                    done();
                } catch (e) {
                    done(e);
                }
            });
    });

    it('sample notebook renderer', function (done) {
        helpers.run(path.join(__dirname, '../generators/app'))
            .withPrompts({
                type: 'ext-notebook-renderer',
                name: 'json-renderer-ext',
                displayName: 'Cool JSON Renderer Extension',
                rendererId: 'json-renderer',
                rendererDisplayName: 'JSON Renderer',
                includeContentProvider: false,
                gitInit: true,
                pkgManager: 'yarn'
            }).toPromise().then(function () {
                var expected = {
                    "name": "json-renderer-ext",
                    "displayName": "Cool JSON Renderer Extension",
                    "description": "",
                    "version": "0.0.1",
                    "engines": {
                        "vscode": engineVersion
                    },
                    "categories": [
                        "Other"
                    ],
                    "enableProposedApi": true,
                    "activationEvents": [],
                    "main": "./out/extension/extension.js",
                    "contributes": {
                        "notebookOutputRenderer": [
                            {
                                "entrypoint": "./out/client/index.js",
                                "viewType": "json-renderer",
                                "displayName": "JSON Renderer",
                                "mimeTypes": ["application/json"]
                            }
                        ]
                    },
                    "scripts": {
                        "vscode:prepublish": "npm run compile && node out/test/checkNoTestProvider.js",
                        "compile": "npm run compile:extension && npm run compile:client",
                        "compile:extension": "tsc -b",
                        "compile:client": "webpack --info-verbosity verbose --mode production",
                        "lint": "eslint src --ext ts",
                        "watch": "concurrently -r \"npm:watch:*\"",
                        "watch:extension": "tsc -b --watch",
                        "watch:client": "webpack --info-verbosity verbose --mode development --watch",
                        "dev": "concurrently -r npm:watch:extension npm:dev:client",
                        "dev:client": "webpack-dev-server",
                        "pretest": "npm run compile && npm run lint",
                        "test": "node ./out/test/runTest.js",
                        "updatetypes": "cd src/extension/types && vscode-dts dev && vscode-dts master && cd ../../test/types && vscode-dts dev && vscode-dts master",
                        "postinstall": "npm run updatetypes"
                    },
                    "devDependencies": devDependencies([
                        "@types/glob",
                        "@types/mocha",
                        "@types/node",
                        "@types/webpack-env",
                        "@typescript-eslint/eslint-plugin",
                        "@typescript-eslint/parser",
                        "@types/vscode-notebook-renderer",
                        "concurrently",
                        "css-loader",
                        "eslint",
                        "fork-ts-checker-webpack-plugin",
                        "glob",
                        "mocha",
                        "style-loader",
                        "ts-loader",
                        "typescript",
                        "vscode-dts",
                        "vscode-notebook-error-overlay",
                        "vscode-test",
                        "webpack",
                        "webpack-cli",
                        "webpack-dev-server"
                    ])
                };
                try {
                    assert.file(['package.json', 'README.md', 'webpack.config.js', '.gitignore', '.vscodeignore', '.eslintrc.json']);

                    const body = fs.readFileSync('package.json', 'utf8');
                    const actual = JSON.parse(body);
                    assert.deepEqual(expected, actual);

                    done();
                } catch (e) {
                    done(e);
                }
            }, done);
    });
});
