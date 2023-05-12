const CoinKey = require('coinkey');
const rp = require('request-promise');
const Promise = require('bluebird');
const HashTable = require('megahash');
const _ = require('lodash');
const wif = require('wif');

const TEST_KEY = '0000000000000000000000000000000000000000000000000000000000000001';
const TEST_ADDRESS = "1JCe8z4jJVNXSjohjM4i9Hh813dLCNx2Sy";

const returnHash = function () {
    abc = "abcdef1234567890".split("");
    let token = "";
    for (i = 0; i < 64; i++) {
        token += abc[Math.floor(Math.random() * abc.length)];
    }
    return token; //Will return a 32 bit "hash"
};

module.exports.doProcess = function () {
    process.on('message', function (json) {
        console.log("Received unknown message from master", JSON.stringify(json))
    });

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
                    return rp('https://blockchain.info/multiaddr?cors=true&active=' + record.wallet)
                        .then(function (result) {
                            let walletDetail = JSON.parse(result);

                            hashtable.set(record.wallet, walletDetail.wallet.final_balance);

                            if (walletDetail.balance > 0) {
                                console.log("Found!", JSON.stringify(record));

                                process.send(
                                    {
                                        "type": "hit",
                                        "data": {
                                            "wallet": record.wallet,
                                            "wif": record.wif,
                                            "balance": walletDetail.wallet.final_balance
                                        }
                                    });
                            } else {
                                if (walletDetail.total_received > 0) {
                                    // Used before
                                    console.log("Interesting!", JSON.stringify(record));

                                    process.send(
                                        {
                                            "type": "dirty",
                                            "data": {
                                                "wallet": record.wallet,
                                                "wif": record.wif,
                                                "balance": walletDetail.wallet.final_balance
                                            }
                                        });
                                } else
                                {
                                    // Pristine wallet
                                    // console.log("Pristine wallet ", record.wallet)
                                }
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
            let key = hashtable.nextKey();
            while (key) {
                console.log(key, 'balance', hashtable.get(key))
                key = hashtable.nextKey(key);
            }

            console.log("DONE");
            process.exit()
        });
};
