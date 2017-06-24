var CoinKey = require('coinkey');
var wif = require('wif');
var rp = require('request-promise');
var Promise = require('bluebird');

const TEST_KEY = '0000000000000000000000000000000000000000000000000000000000000001';
const TEST_ADDRESS = "1JCe8z4jJVNXSjohjM4i9Hh813dLCNx2Sy";

function returnHash() {
    abc = "abcdef1234567890".split("");
    var token = "";
    for (i = 0; i < 64; i++) {
        token += abc[Math.floor(Math.random() * abc.length)];
    }
    return token; //Will return a 32 bit "hash"
}

var cluster = require('cluster');
var numCPUs = require('os').cpus().length;

if (cluster.isMaster) {

    for (var i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    Object.keys(cluster.workers).forEach(function (id) {
        console.log("Worker running with ID : " + cluster.workers[id].process.pid);
    });

    cluster.on('exit', function (worker, code, signal) {
        console.log('Worker ' + worker.process.pid + ' has died');
    });
} else {
    var promiseList = [];
    for (var ix = 0; ix < 1000; ix++) {
        promiseList.push(
            new Promise(function (resolve, reject) {
                var record = {
                    "pk": returnHash()
                };

                var privateKey = new Buffer(record.pk, 'hex');
                record.wif = wif.encode(128, privateKey, true);

                var ck = CoinKey.fromWif(record.wif);
                record.wallet = ck.publicAddress;

                resolve(record);
            })
                .then(function (record) {
                    return rp('https://blockchain.info/q/addressbalance/' + record.wallet)
                        .then(function (htmlString) {
                            if (+(htmlString) > 0) {
                                console.log("Found!", JSON.stringify(record));
                            } else {
                                // console.log("No balance on ", record.wallet)
                            }
                        })
                        .catch(function (err) {
                            console.error(err);
                        });
                })
        );

    }
    Promise.all(promiseList)
        .then(function () {
            console.log("DONE");
        });
}