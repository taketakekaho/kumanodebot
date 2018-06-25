/*----------------------------------------------------------------------------------------
* Azure Functions bot templates use Azure Functions Pack for optimal performance, get 
* familiar with Azure Functions Pack at https://github.com/Azure/azure-functions-pack

* For more information about this template visit http://aka.ms/azurebots-node-qnamaker
* ---------------------------------------------------------------------------------------- */

"use strict";
var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");
var builder_cognitiveservices = require("botbuilder-cognitiveservices");
var path = require('path');

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

var bot = new builder.UniversalBot(connector);
bot.localePath(path.join(__dirname, './locale'));
bot.set('storage', tableStorage);

// Recognizer and and Dialog for preview QnAMaker service
var previewRecognizer = new builder_cognitiveservices.QnAMakerRecognizer({
                knowledgeBaseId: process.env.QnAKnowledgebaseId, 
    authKey: process.env.QnAAuthKey || process.env.QnASubscriptionKey,
    top : 5
    });

var basicQnAMakerPreviewDialog = new builder_cognitiveservices.QnAMakerDialog({
    recognizers: [previewRecognizer],
                defaultMessage: "候補が多数あり、絞り込めません。恐れ入りますが、再度、他の聞き方で試してください。\n例：「質問の表現を変える」、「キーワードを増やす」、「スペースを除く」等",
                qnaThreshold: 0.1,
                top : 5
});

bot.dialog('basicQnAMakerPreviewDialog', basicQnAMakerPreviewDialog);

var cqnaMakerTools = new builder_cognitiveservices.QnAMakerTools();
bot.library(cqnaMakerTools.createLibrary());

// Recognizer and and Dialog for GA QnAMaker service
var recognizer = new builder_cognitiveservices.QnAMakerRecognizer({
    knowledgeBaseId: process.env.QnAKnowledgebaseId,
    authKey: process.env.QnAAuthKey || process.env.QnASubscriptionKey,
    endpointHostName: process.env.QnAEndpointHostName,
    top : 5
});

var basicQnAMakerDialog = new builder_cognitiveservices.QnAMakerDialog({
    recognizers: [recognizer],
    defaultMessage: "候補が多数あり、絞り込めません。恐れ入りますが、再度、他の聞き方で試してください。\n例：「質問の表現を変える」、「キーワードを増やす」、「スペースを除く」等",
    qnaThreshold: 0.1,
    top : 5,
    feedbackLib: cqnaMakerTools
}
);

bot.dialog('basicQnAMakerDialog', basicQnAMakerDialog);

bot.dialog('/', //basicQnAMakerDialog);
[
    function (session){
        var qnaKnowledgebaseId = process.env.QnAKnowledgebaseId;
        var qnaAuthKey = process.env.QnAAuthKey || process.env.QnASubscriptionKey; // Backward compatibility with QnAMaker (Preview)
        var endpointHostName = process.env.QnAEndpointHostName;
        
        // QnA Subscription Key and KnowledgeBase Id null verification
        if ((qnaAuthKey == null || qnaAuthKey == '') || (qnaKnowledgebaseId == null || qnaKnowledgebaseId == ''))
            session.send('Please set QnAKnowledgebaseId, QnAAuthKey and QnAEndpointHostName (if applicable) in App Settings. Learn how to get them at https://aka.ms/qnaabssetup.');
        else {
            if (endpointHostName == null || endpointHostName == '')
                // Replace with Preview QnAMakerDialog service
                session.replaceDialog('basicQnAMakerPreviewDialog');
            else
                // Replace with GA QnAMakerDialog service
                session.replaceDialog('basicQnAMakerDialog');
        }       
    }
]);

var instructions = '「ごみ分別に関してFAQ-BOTがお答えします。メッセージ欄に分別したいゴミの種類を入力してください。';

bot.on('conversationUpdate', function(activity) {
  // When user joins conversations, send instructions
  if(activity.membersAdded) {
    activity.membersAdded.forEach(function(identity) {
      if(identity.id === activity.address.bot.id) {
        var reply = new builder.Message()
          .address(activity.address)
          .text(instructions);
        bot.send(reply);
      }
    });
  }
});


if (useEmulator) {
    var restify = require('restify');
    var server = restify.createServer();
    server.listen(3978, function() {
        console.log('test bot endpont at http://localhost:3978/api/messages');
    });
    server.post('/api/messages', connector.listen());    
} else {
    module.exports = connector.listen();
}