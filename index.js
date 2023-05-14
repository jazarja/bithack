const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const Database = require('better-sqlite3');
const db = new Database('bithack.db', {});

if (cluster.isMaster) {
    let addresses = 0, hit = 0, dirty = 0, pristine = 0;

    for (let i = 0; i < 1; i++) {
        cluster.fork();
    }

    const attachEventHandler = (id) => {
        cluster.workers[id].on('message', (json) => {

            if (json.type === "stats") {
                addresses += json.data.addresses;
                hit += json.data.hit;
                dirty += json.data.dirty;
                pristine += json.data.pristine;
            } else if (json.type === "hit") {
                let stmt = db.prepare("INSERT INTO result VALUES (@wallet, @wif, @balance)");
                stmt.run(json.data);
            } else if (json.type === "dirty") {
                let stmt = db.prepare("INSERT INTO dirty VALUES (@wallet, @wif, @balance)");
                stmt.run(json.data);
            } else {
                console.log("Received unknown message from worker", JSON.stringify(json));
            }
        });
    }

    Object.keys(cluster.workers).forEach((id) => {
        // console.log("Worker " + id + " running with ID : " + cluster.workers[id].process.pid);
        attachEventHandler(id)
        // cluster.workers[id].send({type:"message", "message" : "Start"});
    });

    cluster.on('exit', function (worker, code, signal) {
        // console.log('Worker ' + worker.process.pid + ' has died');
        console.log("Processed", "addresses", addresses, "hit", hit, "dirty", dirty);
        cluster.fork();
        Object.keys(cluster.workers).forEach((id) => {
            // console.log("Worker " + id + " running with ID : " + cluster.workers[id].process.pid);
            attachEventHandler(id)
        });
    });
} else {
    const worker = require("./worker");
    worker.doProcess();
}
