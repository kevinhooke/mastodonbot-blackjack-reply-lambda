let AWS = require("aws-sdk");

// lastUpdatedKey: key name of the the key being tracked
// lastReplyId: id value of last id replied to
exports.updateDbStatus = function(lastUpdatedKey, lastReplyId) {

    console.log("updateDbStatus called with id: " + lastReplyId);

    AWS.config.update({
        region: "us-west-1",
        //endpoint: "http://localhost:8000"
        endpoint : "https://dynamodb.us-west-1.amazonaws.com"
    });

    let docClient = new AWS.DynamoDB.DocumentClient();

    let now = new Date().getTime().toString();

    let params = {
        TableName: "mastodonbot-blackjack-replies",
        Key: {
            "statusKey": lastUpdatedKey
        },
        UpdateExpression: "set lastReplyId = :lastReplyId",
        ExpressionAttributeValues: {
            ":lastReplyId": lastReplyId
        },
        ReturnValues: "UPDATED_NEW"
    };

    console.log("Updating the item...");
    return docClient.update(params).promise();
}

exports.getLastDbStatus = function(lastStatusKey) {

    console.log("getLastDbStatus called with key: " + lastStatusKey);

    AWS.config.update({
        region: "us-west-1",
        //endpoint: "http://localhost:8000"
        endpoint : "https://dynamodb.us-west-1.amazonaws.com"
    });

    let docClient = new AWS.DynamoDB.DocumentClient();

    let now = new Date().getTime().toString();

    //ScanIndexForward: false to return in descending order
    //condition > 0 doesn't have much value here but we need to specify some condition for a query
    let params = {
        TableName: "mastodonbot-blackjack-replies",
        KeyConditionExpression : 'statusKey = :status',
        ExpressionAttributeValues : {
            ':status' : lastStatusKey
        },
    };

    return docClient.query(params).promise();
}