var net = require('net');
var fs = require('fs');
var ejs = require('ejs');
var path = require('path');

var DIR_MODULE = path.dirname(module.filename);

var test = function (name, callback) {
    'use strict';

    var name_underscore = name.replace(/\s/g, "_");
    var tests = this.tests;
    tests[name_underscore] = {name: name, logs: [], points: []};

    var start = new Date().toTimeString().slice(0, 8);
    tests[name_underscore].logs.push({time: start, message: "Tests starts"});
    tests[name_underscore].logs.push({time: start, message: "Tests ends"});

    var log = function (log) {

        //Last tests ends is overwritten and a new one is added
        var now = new Date();
        var nowToString = now.toTimeString().slice(0, 8);
        var lastLogPos = tests[name_underscore].logs.length - 1;
        tests[name_underscore].logs[lastLogPos] = {time: nowToString, message: log};

        var end = new Date().toTimeString().slice(0, 8);
        tests[name_underscore].logs.push({time: end, message: "Tests ends"});
    };

    var point = function (x, y) {
        var p = {x: x, y: y};
        tests[name_underscore].points.push(p);
    };

    callback(log, point);
};

var done = function () {
    'use strict'

    var name = this.name;
    var description = this.description;
    var template = this.template;
    var axes = this.axes;
    var tests = this.tests;
    var path = this.path;
    var clients = this.clients;

    function writeAndClose(CPU_Mem) {
        fs.readFile(DIR_MODULE + '/' + template + '.ejs', function (err, data) {

            if (!err) {

                var html = ejs.render(data.toString(), {
                    name: name,
                    description: description,
                    Xaxis: axes[0],
                    Yaxis: axes[1],
                    tests: tests,
                    CPU_Mem: JSON.stringify(CPU_Mem)
                });

                var now = new Date();
                var nowToString = now.toTimeString().slice(0, 8);
                var file = path + '/' + name + '-' + nowToString + '.html';

                fs.writeFile(file, html, function (err) {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('The file ' + file + ' has been created successfully.');
                    }
                });


            } else {
                console.log('ERROR: The chosen template does not exist.')
            }
        });

        for (var i = 0; i < clients.length; i++) {
            clients[i].removeAllListeners();
            clients[i].end();
        }
    };

    setTimeout(writeAndClose.bind({}, this.CPU_Mem), 10000);
};

var Describe = function (name, description, template, axes, hosts, path) {
    'use strict'

    this.name = name;
    this.description = description;
    this.template = template;
    this.axes = axes;
    this.path = path;
    this.test = test;
    this.done = done;
    this.tests = {};
    this.createAndLaunchMonitors = createAndLaunchMonitors;
    this.clients = [];

    //this.num_tests = 0;

    if (hosts.length !== 0) {
        this.CPU_Mem = {};
        this.createAndLaunchMonitors(hosts, this.clients);
    }

    try {
        var stats = fs.lstatSync(path);
        if (!stats.isDirectory()) {
            console.log('Can\'t create directory ' + path + ' :the file exists');
            process.exit();
        }
    } catch (e) {

        var directories = path.split('/');
        var aux = '';

        for (var i = 0; i < directories.length; i++) {
            if (directories[i] !== '') {
                aux += directories[i] + '/';
                fs.mkdir(aux);
            }
        }

        console.log('The directory ' + aux + ' has been created');
    }
};


var createAndLaunchMonitors = function (hosts, clients) {
    'use strict';

    var i = 0;
    var CPU_Mem = this.CPU_Mem;
    var start = this.start;
    console.log(hosts.length);
    for (i = 0; i < hosts.length; i++) {
        var host = hosts[i];
        var client = new net.Socket();
        console.log("entra");
        clients.push(client);
        client.connect(8091, host, function () {
            client.on('data', function (data) {

                var splitted = data.toString().split('\n');

                //The last is not a JSON. Is an empty string so it should not be parsed.
                for (var i = 0; i < splitted.length - 1; i++) {
                    var validData = splitted[i];
                    var JSONdata = JSON.parse(validData);
                    var id = JSONdata.host + '_' + JSONdata.name + '_' + JSONdata.pid;

                    if (!(CPU_Mem.hasOwnProperty(id))) {
                        CPU_Mem[id] = [];
                    }

                    CPU_Mem[id].push({host: JSONdata.host, name: JSONdata.name, pid: JSONdata.pid, cpu: JSONdata.cpu.percentage, memory: parseInt(JSONdata.memory.value)});
                }
            });

        });

        client.on('error', function (host,err) {
            console.log('monitor on \'' + host +'\' is not connected or is not working');
        }.bind(null,host));
    }
};

var describe = function (name, description, template, axes, hosts, path) {
    return new Describe(name, description, template, axes, hosts, path);
};

exports.describe = describe;