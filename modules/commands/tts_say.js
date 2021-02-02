const util = require('util');
const join = require('./basic_join.js');
const { logger } = require('../common');
const discord = require('../discord.js');
const string = require('../stringManager.js');
const TTSClass = require('../textToSpeech.js');

const devFlag = process.env.NODE_ENV === 'development' ? true : false;
const regexMention = /<(#|@!)[0-9]{18}>/g;
const regExSpecial = /[\{\}\[\]\/;:|\)*`^_~<>\#\\\=\(]/gi;

function messageFix(message, content) {
    /* replace raw mention id to discord mention */
    let finalMsg = content.replace(regexMention, (match, $1) => {
        let id = match.replaceAll(/[<>]/g, '');
        if (id.includes('@!')) {
            id = message.guild.members.cache.get(id.replace('@!', '')).displayName;
            return id;
        } else if (id.includes('#')) {
            const asyncFetchChannel = util.promisify(message.client.channels.fetch);
            const channel = asyncFetchChannel(id.replace('#', ''));
            id = channel.name;
            return id;
        }
    });

    /* Replace '@'(at) symbol to text '-at-' */
    finalMsg = finalMsg.replaceAll('@', '-at-');

    /* Replace '&'(and) symbol to text '-and-' */
    finalMsg = finalMsg.replaceAll('&', '-and-');

    /* Replace TTS unreadable charater to whitespace */
    finalMsg = finalMsg.replaceAll(regExSpecial, ' ');
    return finalMsg;
}

async function commandSay(message, args) {
    /* If not joined to voice channel, join first */
    if (!discord.voiceMap.get(message.guild.id)) {
        const response = await join.execute(message, []);
        if (response.result === 'FAIL') return;
    }
    const voice = discord.voiceMap.get(message.guild.id);
    /* If TTS is not initalized, do it first */
    if (!voice.TTS) voice.TTS = new TTSClass();
    /* Fix message for TTS-readable */
    const text = args.join(' ');
    const fixedText = await messageFix(message, text);
    logger.log('verbose', `[discord.js] ${message.author} spoken: ${text}`);
    try {
        /* Send message and TTS to discord */
        message.channel.send(string.stringFromId('chattybot.tts.text.format', voice.channel.name, message.author, text));
        /* If bot have message delete permission, delete user's message */
        if (message.guild.me.hasPermission('MANAGE_MESSAGES')) message.delete();
        voice.TTS.setQueue(message.author.id, fixedText);
        /* If TTS is already speaking, do not call TTS */
        if (voice.TTS.speaking === true) return;
        await voice.TTS.speak(message);
    } catch(err) {
        logger.log('error', `[discord.js] Failed to launch requested command: ${err.stack}`);
        let _msg = string.stringFromId('discord.error.exception.line1') + '\n';
        if (!devFlag) _msg += string.stringFromId('discord.error.exception.line2.prod');
        else _msg += string.stringFromId('discord.error.exception.line2.dev') + '\n```\n' + err.stack + '```';
    }
}

module.exports = {
    name: 'chattybot.command.say',
    description: 'chattybot.command.say.desc',
    argsRequired: true,
    aliases: 'chattybot.command.say.aliases',
    usage: 'chattybot.command.say.usage',
    cooldown: 5,
    execute: commandSay
}
