/**
 * Prepros
 * (c) Subash Pathak
 * sbshpthk@gmail.com
 * License: MIT
 */


/*jshint browser: true, node: true*/
/*global prepros,  _*/

prepros.factory("watcher", function (projectsManager, notification, config, compiler, $filter, liveServer, fileTypes, $rootScope, utils) {

    "use strict";

    var fs = require("fs"),
        chokidar = require('chokidar'),
        path = require('path');

        var projectsBeingWatched = [];

        var supported = /\.(:?less|sass|scss|styl|md|markdown|coffee|js|jade|haml|slim|ls)$/gi;
        var notSupported = /\.(:?png|jpg|jpeg|gif|bmp|woff|ttf|svg|ico|eot|psd|ai|tmp|html|htm|css|rb|php|asp|aspx|cfm|chm|cms|do|erb|jsp|mhtml|mspx|pl|py|shtml|cshtml|cs|vb|vbs)$/gi;

    //Function to start watching file
    function startWatching(projects) {

        var ids = _.pluck(projects, 'id');

        _.each(projectsBeingWatched, function(project) {

            if(!_.contains(ids, project.id)) {

                project.watcher.close();

                delete projectsBeingWatched[project.id];
            }
        });

        _.each(projects, function(project) {

            if(!(project.id in projectsBeingWatched)) {

                var watcher = chokidar.watch(project.path, {
                    ignored: function(f) {

                        //Ignore dot files or folders
                        if(/\\\.|\/\./.test(f)) {
                            return true;
                        }

                        var ext = path.extname(f);

                        if(projectsManager.matchFilters(project.id, f)) {

                            return true;
                        }

                        if(ext.match(supported)) {

                            return false;

                        } else if(ext.match(notSupported)) {

                            return true;

                        } else {

                            try {

                                if(fs.statSync(f).isDirectory()) {

                                    return false;
                                }

                            } catch(e) {}
                        }

                        return true;
                    },
                    interval: 400,
                    ignorePermissionErrors: true,
                    ignoreInitial: true,
                    usePolling : !config.getUserOptions().experimental.fileWatcher
                });

                var changeHandler = function(fpath) {

                    if(!fs.existsSync(fpath)) {
                        return;
                    }

                    _.each(project.files, function(file) {

                        var filePath = $filter('fullPath')(file.input, { basePath: project.path});

                        if(path.relative(filePath, fpath)=== "") {

                            if (file.config.autoCompile) {

                                //Compile File
                                compiler.compile(file.pid, file.id);
                            }
                        }
                    });

                    _.each(project.imports, function(imp) {

                        var filePath = $filter('fullPath')(imp.path, { basePath: project.path});

                        if(path.relative(filePath, fpath)=== "") {

                            _.each(imp.parents, function (parentId) {

                                var parentFile = projectsManager.getFileById(imp.pid, parentId);

                                if (!_.isEmpty(parentFile) && parentFile.config.autoCompile) {

                                    compiler.compile(imp.pid, parentId);
                                }
                            });
                        }
                    });
                };

                var debounceChange = function(fpath) {

                    if(config.getUserOptions().experimental.fileWatcher) {

                        return _.debounce(function() {
                            changeHandler(fpath);
                        }, 50);

                    } else {
                        return changeHandler(fpath);
                    }
                };

                watcher.on('change', debounceChange);

                watcher.on('error', function(err) {
                    //Ignore all errors;  there are too many to notify the user
                });

                projectsBeingWatched[project.id] = {
                    id: project.id,
                    watcher: watcher
                };
            }

        });
    }

    return{
        startWatching: startWatching
    };

});

