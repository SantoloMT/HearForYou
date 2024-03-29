﻿// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { InputHints,
        ActivityTypes,
        ActionTypes,
        CardFactory
        } = require('botbuilder');
const { LuisRecognizer 
        } = require('botbuilder-ai');
const { ComponentDialog, 
        DialogSet, 
        DialogTurnStatus, 
        TextPrompt, 
        WaterfallDialog 
    } = require('botbuilder-dialogs');

//Import secondary dialogs
const {
    TranslateDialog
} = require('./translateDialog');

const {
    SpeechToTextDialog
} = require('./speechToTextDialog');

const {
    OcrDialog
} = require('./ocrDialog.js');

const {
    TextToSpeechDialog
} = require('./textToSpeechDialog.js');

const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const MAIN_DIALOG = 'MAIN_DIALOG'
const TEXT_PROMPT = 'TEXT_PROMPT';



class MainDialog extends ComponentDialog {
    constructor(luisRecognizer, userState) {
        super('MAIN_DIALOG');

        if (!luisRecognizer) throw new Error('[MainDialog]: Missing parameter \'luisRecognizer\' is required');
        this.luisRecognizer = luisRecognizer;
        this.userState = userState;

        //Adding used dialogs
        this.addDialog(new TextToSpeechDialog());
        this.addDialog(new OcrDialog());
        this.addDialog(new SpeechToTextDialog());
        this.addDialog(new TranslateDialog(luisRecognizer));
        this.addDialog(new TextPrompt('TEXT_PROMPT'));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.introStep.bind(this),
                this.menuStep.bind(this),
                this.mainMenuStep.bind(this),
                this.optionStep.bind(this),
                this.loopStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    /**
     * The run method handles the incoming activity (in the form of a TurnContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {*} turnContext
     * @param {*} accessor
     */
    async run(turnContext, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);
        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

   
    async introStep(step) {
        if (!this.luisRecognizer.isConfigured) {
            const messageText = 'NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.';
            await step.context.sendActivity(messageText, null, InputHints.IgnoringInput);
            return await step.next();
        }

        const messageText = 'Come posso aiutarti?\n\nSe vuoi sapere cosa posso fare per te scrivi \"menu\"';
        return await step.prompt(TEXT_PROMPT, {
            prompt: messageText
        });


    }

    async menuStep(step) {

        const option = step.result;
        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        if (option === "menu" || LuisRecognizer.topIntent(luisResult, "", 0.8) === 'Menu') {
            return await step.next();
        }
        else if (option === "Esci" || LuisRecognizer.topIntent(luisResult, "", 0.7) === 'StopBot') {

            await step.context.sendActivity("Spero di esserti stato d'aiuto! Ciao, alla prossima!👋");
            return await step.cancelAllDialogs(this.id);

        }
        else {
            await step.context.sendActivity("Sembra che tu abbia digitato un comando che non conosco!⛔ Riprova.");
            return await step.replaceDialog(this.id);
        }

    }

    /**
     * Pulsanti menù principale del bot
     */
    async mainMenuStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };

        const buttons = [{
                type: ActionTypes.ImBack,
                title: '🌏Traduci un testo in altra lingua',
                value: 'Traduci'
            },
            {
                type: ActionTypes.ImBack,
                title: '📄Genera un file testuale a partire da un file audio',
                value: 'convertimi una registrazione in un testo'
            },
            {
                type: ActionTypes.ImBack,
                title: '🔊Genera un file audio a partire da un file testuale',
                value: 'generami un audio da un testo'
            },
            {
                type: ActionTypes.ImBack,
                title: '🖼Ricava il testo da un immagine',
                value: 'testo da immagine'
            }
        ];

        const card = CardFactory.heroCard(
            '',
            undefined,
            buttons, {
                text: 'HearForYouBot menu'
            }
        );

        reply.attachments = [card];

        await step.context.sendActivity(reply);

        return await step.prompt(TEXT_PROMPT, {
            prompt: 'Seleziona un\'opzione dal menu per proseguire!'
        });
        
    }

    
    async optionStep(step) {
        const option = step.result.value;
            const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        if (option === "Traduci" || LuisRecognizer.topIntent(luisResult, "", 0.7) === 'Traduzione' ) {
                console.log("Vado nel dialogo che gestisce la traduzione");
                return await step.beginDialog("TRANSLATE_DIALOG");
            }

              else if (option === "Tradurre un file audio in testuale" || LuisRecognizer.topIntent(luisResult, "", 0.7) === 'AudioTesto') {
                console.log("Vado nel dialogo che gestisce lo SpeechToText");
                return await step.beginDialog("SPEECHTOTEXT_DIALOG");
            }

              else if (option === "Tradurre un file testuale in audio" || LuisRecognizer.topIntent(luisResult, "", 0.7) === 'TestoAudio') {
                console.log("Vado nel dialogo che gestisce il TextToSpeech");
                return await step.beginDialog("TEXTTOSPEECH_DIALOG");
            }

              else if (option === "Prendere testo da immagine" || LuisRecognizer.topIntent(luisResult, "", 0.7) === 'TestoDaImmagine') {
                console.log("Vado nel dialogo che gestisce l'OCR");
                return await step.beginDialog("OCR_DIALOG");
              }

              else if (option === "Esci" || LuisRecognizer.topIntent(luisResult, "", 0.7) === 'StopBot') {

            await step.context.sendActivity("Spero di esserti stato d'aiuto! Ciao, alla prossima!👋");
                  return await step.cancelAllDialogs(this.id);

              }

            else {

                  await step.context.sendActivity("Sembra che tu abbia digitato un comando che non conosco!⛔ Riprova.");
            }

            return await step.replaceDialog(this.id);
        }

        async loopStep(step) {
            return await step.replaceDialog(this.id);
        }
    }
    module.exports.MainDialog = MainDialog;
    module.exports.MAIN_DIALOG = MAIN_DIALOG;

   
