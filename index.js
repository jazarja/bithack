const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const Database = require('better-sqlite3');
const db = new Database('bithack.db', {});

if (cluster.isMaster) {
    for (let i = 0; i < 1; i++) {
        cluster.fork();
    }

    Object.keys(cluster.workers).forEach(function (id) {
        console.log("Worker running with ID : " + cluster.workers[id].process.pid);

        cluster.workers[id].on('message', function(json){

            if (json.type==="hit")
            {
                let stmt = db.prepare("INSERT INTO result VALUES (@wallet, @wif, @balance)");
                stmt.run(json.data);
            } else
            if (json.type==="dirty")
            {
                let stmt = db.prepare("INSERT INTO dirty VALUES (@wallet, @wif, @balance)");
                stmt.run(json.data);
            } else
            {
                console.log("Received unknown message from worker", JSON.stringify(json));
            }
        });

        // cluster.workers[id].send({type:"message", "message" : "Start"});
    });

    cluster.on('exit', function (worker, code, signal) {
        console.log('Worker ' + worker.process.pid + ' has died');
    });
} else {
    const worker = require("./worker");
    worker.doProcess();
}
