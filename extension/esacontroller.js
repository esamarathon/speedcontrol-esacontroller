'use strict';

var app = require('express')();
var request = require('request');
var clone = require('clone');
var nodecg = require('./utils/nodecg-api-context').get();

if (typeof(nodecg.bundleConfig) !== 'undefined' && nodecg.bundleConfig.enable) {
	register_api()
}

function register_api() {
	nodecg.log.info("Activating API.");
    var speedcontrolRouter = require('express').Router();

    speedcontrolRouter.use(function(req, res, next) {
        if (req.get('API-Key') !== nodecg.bundleConfig.sharedKey) {
            res.status(403).json("Invalid key.");
        } else {
            next();
        }
    });

    speedcontrolRouter.get("/timers", function(req, res) {
        var result = []
        nodecg.readReplicant("runDataActiveRun", 'nodecg-speedcontrol').teams.forEach(function(team, i) {
            result[i] = {
                id: team.id,
                status: "waiting"
            };
        });

        const timer = nodecg.readReplicant('timer', 'nodecg-speedcontrol')
        //nodecg.log.info(timer);
        if (timer.state == "running") {
            result.forEach(function(runner) {
                runner.status = "running";
            });
        }

        //Get all finished players
        nodecg.readReplicant("finishedTimers", 'nodecg-speedcontrol').forEach(function(timer, i) {
            if (timer.time != '00:00:00') {
                result.forEach(function(runner) {
                    if (runner.id == timer.id) {
                        runner.status = "finished";
                    }
                });
            }
                
        })

        res.status(200).json(result);
    });

    speedcontrolRouter.put("/timer/start", function(req, res) {
        nodecg.sendMessageToBundle("start_run", 'nodecg-speedcontrol');
        res.status(200).json(true);
    });

    speedcontrolRouter.put("/timer/:id/split", function(req, res) {
        nodecg.sendMessageToBundle("split_timer", 'nodecg-speedcontrol', req.params.id);
        res.status(200).json(true);
    });

    speedcontrolRouter.put("/timer/reset", function(req, res) {
        nodecg.sendMessageToBundle("reset_run", 'nodecg-speedcontrol');
        res.status(200).json(true);
    });

    var activeRunStartTime = nodecg.Replicant('activeRunStartTime', {defaultValue: 0});
	var lastrundata = nodecg.Replicant("esaRunDataLastRun", {defaultValue: undefined})
	
	nodecg.listenFor('resetTime', 'nodecg-speedcontrol', () => {
		activeRunStartTime.value = 0;
	});

    nodecg.listenFor("splitRecording", "nodecg-speedcontrol", function(message) {
        activeRunStartTime.value = getTimeStamp();
        publish({
            event: "runStarted",
            data: getRunData(),
            oldrun: nodecg.readReplicant("esaRunDataLastRun")
		})
		lastrundata.value = undefined;
	});
	
	// Store the currently set run when the timer first starts, which we will use for the upload info.
	var timer = nodecg.Replicant('timer', "nodecg-speedcontrol");
	timer.on('change', (newVal, oldVal) => {
		if (!lastrundata.value && oldVal && oldVal.state === 'stopped' && newVal.state === 'running')
			lastrundata.value = clone(getRunData());
	});

	// The runEnded event no longer exists so this is here for reference
    /*nodecg.listenFor("runEnded", "nodecg-speedcontrol", function(message) {
        nodecg.log.info(nodecg.readReplicant("runDataActiveRun", 'nodecg-speedcontrol'))
        var data = getRunData()
        lastrundata.value = clone(data);

        nodecg.log.info(JSON.stringify(data));
        publish({
            event: "runEnded",
            data: data
        });
    });*/

    app.use('/speedcontrol', speedcontrolRouter);
    nodecg.mount(app);
}

function getRunData() {
	// Some bad code to get the sponsored data if it exists.
	var runCustomData = nodecg.readReplicant("runDataActiveRun", "nodecg-speedcontrol").customData;
	var sponsored = false;
	if (runCustomData && runCustomData.info && runCustomData.info.toLowerCase() === 'sponsored')
		sponsored = true;

	var players = [];
	nodecg.readReplicant("runDataActiveRun", 'nodecg-speedcontrol').teams.forEach(team => {
		team.players.forEach(player => players.push(player));
	});

    return {
        game: nodecg.readReplicant("runDataActiveRun", 'nodecg-speedcontrol').game,
        category: nodecg.readReplicant("runDataActiveRun", 'nodecg-speedcontrol').category,
        console: nodecg.readReplicant("runDataActiveRun", 'nodecg-speedcontrol').console,
        teams: nodecg.readReplicant("runDataActiveRun", 'nodecg-speedcontrol').teams,
		players: players,
		sponsored: sponsored,
        time: nodecg.readReplicant("timer", 'nodecg-speedcontrol').time,
        start: nodecg.readReplicant("activeRunStartTime"),
        end: getTimeStamp()
    }
}

function getTimeStamp() {
    return Date.now()/1000;
}

function publish(event) {
    if (nodecg.bundleConfig.hooks) {
        nodecg.bundleConfig.hooks.forEach(function(sub) {
            request.post({
                    uri: sub, 
                    json: event, 
                    timeout: 1500,
                    headers: {
                        'API-Key': nodecg.bundleConfig.sharedKey
                    }
                }, 
                function(err) {
                    if (err) {
                        nodecg.log.error(
                            "Error publishing event " + event.event + " to " + sub + ".", 
                            err);
                }
            })
        });
    }
}