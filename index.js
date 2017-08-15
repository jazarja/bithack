const CoinKey = require('coinkey');
const wif = require('wif');
const rp = require('request-promise');
const Promise = require('bluebird');
const HashTable = require('hashtable');
const cluster = require('cluster');
const _ = require('lodash');
const numCPUs = require('os').cpus().length;

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

if (cluster.isMaster) {
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    Object.keys(cluster.workers).forEach(function (id) {
        console.log("Worker running with ID : " + cluster.workers[id].process.pid);
    });

    cluster.on('exit', function (worker, code, signal) {
        console.log('Worker ' + worker.process.pid + ' has died');
    });
} else {
    let hashtable = new HashTable();
    let promiseList = [];
    for (let ix = 0; ix < 100; ix++) {
        promiseList.push(
            new Promise(function (resolve, reject) {
                let record = {
                    "pk": returnHash()
                };

                let privateKey = new Buffer(record.pk, 'hex');
                record.wif = wif.encode(128, privateKey, true);

                let ck = CoinKey.fromWif(record.wif);
                record.wallet = ck.publicAddress;

                resolve(record);
            })
                .then(function (record) {
                    return rp('https://blockchain.info/q/addressbalance/' + record.wallet)
                        .then(function (htmlString) {
                            hashtable.put(record.wallet, +(htmlString));

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
            _.each(hashtable.keys(), function(key){
                console.log(key, hashtable.get(key))
            });
            console.log("DONE");
        });
}