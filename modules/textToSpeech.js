const GcpTts = require('@google-cloud/text-to-speech');
const path = require('path');
const configManager = require('./configManager.js');
const discord = require('./discord.js');
const string = require('./stringManager.js');
const { bufferToStream, getUsername, logger, uniq } = require('./common');

/* read config from file */
const config = configManager.read('project_id');

function getVoiceList(ttsClient, callback) {
    
}

class TTSClass {
    constructor() {
        this._client = new GcpTts.TextToSpeechClient({ projectId: config.projectId, keyFilename: path.join(__dirname, '../configs/gcp-credentials.json') });
        this._lastAuthor = undefined;
        this._request = {
            input: { text: 'This is a sample text.' },
            voice: { languageCode: string.locale, ssmlGender: 'NEUTRAL' },
            audioConfig: { audioEncoding: 'OGG_OPUS', speakingRate: '1.0', pitch: '0.0', volumeGainDb: '0.0' }
        };
    }

    /* get-set setting entry */
    get gender() {
        return this._request.voice.ssmlGender;
    }
    set gender(code) {
        switch (code) {
            case string.stringFromId('google.tts.gender.female'):
                this._request.voice.ssmlGender = "FEMALE";
                break;
            case string.stringFromId('google.tts.gender.male'):
                this._request.voice.ssmlGender = "MALE";
                break;
            case string.stringFromId('google.tts.gender.neutral'):
                this._request.voice.ssmlGender = "NEUTRAL";
                break;
        }
    }

    get locale() {
        return this._request.voice.languageCode;
    }
    /* Do NOT use setter for locale, it requires asyncronization */
    async setLocale(code) {
        let locales = [];
        try {
            const [result] = await this._client.listVoices({});
            result.voices.forEach(voice => locales = [...locales, ...voice.languageCodes] );
        } catch (err) {
            /* Error while retrieving suppoerted locale list */
            console.log(err.stack);
        }
        /* remove duplicates from array */
        locales = uniq(locales);
        /* apply locale if available */
        if (locales.includes(code))
            this._request.voice.languageCode = code;
    }

    get pitch() {
        const pitch = parseFloat(this._request.audioConfig.pitch);
        if (pitch < 0 && pitch >= -5.0)
            return (pitch * (-10)) + 100;
        else if (pitch <= 5.0 && pitch >= 0)
            return (pitch * 20) + 100;
    }
    set pitch(rate) {
        const newPitch = parseInt(rate);
        if (newPitch < 100 && newPitch >= 50)
            this._request.audioConfig.pitch = (100 - newPitch) / (-10); 
        else if (newPitch <= 200 && newPitch >= 100)
            this._request.audioConfig.pitch = (newPitch - 100) / 20;
    }

    get speed() {
        return parseFloat(this._request.audioConfig.speakingRate) * 100;
    }
    set speed(rate) {
        const newSpeed = parseInt(rate) / 100;
        if (newSpeed <= 2 && newSpeed >= 0.5)
            this._request.audioConfig.speakingRate = newSpeed;
    }

    get volume() {
        return ((parseFloat(this._request.audioConfig.volumeGainDb) + 24) / 24) * 100;
    }
    set volume(rate) {
        const newVolume = ((parseInt(rate) / 100) * 24) - 24;
        if (newVolume <= 0 && newVolume >= -24)
            this._request.audioConfig.volumeGainDb = newVolume;
    }

    async speak(message, text, ssml=false) {
        const voice = discord.voiceMap.get(message.guild.id);
        /* If message author or channel is different, send TTS w/ prefix. */
        if (this._lastAuthor !== message.author) {
            this._request.input = { ssml: '<speak>' + string.stringFromId('catty.tts.prefix', getUsername(message)) + 
            '<break time="0.5s"/>' + text + '</speak>' };
        /* If not, send just text only */
        } else this._request.input = { text };
        this._lastAuthor = message.author;
        const [response] = await this._client.synthesizeSpeech(this._request);
        /* Google sends response as buffer. We need to convert it as ReadableStream. */
        const stream = bufferToStream(response.audioContent);
        return voice.play(stream, { type: 'ogg/opus' });
    }
}

module.exports = TTSClass;
