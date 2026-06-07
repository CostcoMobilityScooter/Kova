const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');

// Per-guild queues: Map<guildId, { connection, player, queue: [], current, volume }>
const queues = new Map();

function getQueue(guildId) { return queues.get(guildId); }
function createQueue(guildId, data) { queues.set(guildId, data); return data; }
function deleteQueue(guildId) { queues.delete(guildId); }

async function resolveTrack(query) {
  if (/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(query)) {
    const info = await ytdl.getInfo(query);
    return {
      title: info.videoDetails.title,
      url: info.videoDetails.video_url,
      duration: formatDuration(parseInt(info.videoDetails.lengthSeconds)),
      thumbnail: info.videoDetails.thumbnails?.[0]?.url,
    };
  }
  const results = await ytSearch(query);
  const video = results.videos[0];
  if (!video) return null;
  return { title: video.title, url: video.url, duration: video.timestamp, thumbnail: video.thumbnail };
}

function formatDuration(secs) {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function playNext(guildId, client) {
  const q = getQueue(guildId);
  if (!q || q.queue.length === 0) {
    if (q?.connection) q.connection.destroy();
    deleteQueue(guildId);
    return;
  }

  const track = q.queue.shift();
  q.current = track;

  const stream = ytdl(track.url, { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25 });
  const resource = createAudioResource(stream, { inlineVolume: true });
  resource.volume.setVolume(q.volume);
  q.player.play(resource);

  q.player.once(AudioPlayerStatus.Idle, () => playNext(guildId, client));
  q.player.once('error', () => playNext(guildId, client));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Music player')
    .addSubcommand(s => s.setName('play').setDescription('Play a song').addStringOption(o => o.setName('query').setDescription('Song name or YouTube URL').setRequired(true)))
    .addSubcommand(s => s.setName('skip').setDescription('Skip the current song'))
    .addSubcommand(s => s.setName('stop').setDescription('Stop music and clear queue'))
    .addSubcommand(s => s.setName('queue').setDescription('Show the current queue'))
    .addSubcommand(s => s.setName('nowplaying').setDescription('Show the current song'))
    .addSubcommand(s => s.setName('pause').setDescription('Pause the music'))
    .addSubcommand(s => s.setName('resume').setDescription('Resume the music'))
    .addSubcommand(s => s.setName('volume').setDescription('Set volume').addIntegerOption(o => o.setName('level').setDescription('Volume 1-100').setMinValue(1).setMaxValue(100).setRequired(true))),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    if (sub === 'play') {
      if (!voiceChannel) return interaction.reply({ content: '❌ Join a voice channel first!', ephemeral: true });
      await interaction.deferReply();

      const query = interaction.options.getString('query');
      const track = await resolveTrack(query).catch(() => null);
      if (!track) return interaction.editReply('❌ Could not find that song.');

      let q = getQueue(interaction.guildId);
      if (!q) {
        const connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId: interaction.guildId, adapterCreator: interaction.guild.voiceAdapterCreator });
        const player = createAudioPlayer();
        connection.subscribe(player);
        q = createQueue(interaction.guildId, { connection, player, queue: [], current: null, volume: 0.5 });

        connection.on(VoiceConnectionStatus.Disconnected, async () => {
          try { await entersState(connection, VoiceConnectionStatus.Reconnecting, 5000); }
          catch { connection.destroy(); deleteQueue(interaction.guildId); }
        });
      }

      q.queue.push(track);

      const embed = new EmbedBuilder().setColor(0xff0000)
        .setTitle(q.current ? '➕ Added to Queue' : '▶️ Now Playing')
        .setDescription(`**[${track.title}](${track.url})**`)
        .addFields({ name: 'Duration', value: track.duration, inline: true }, { name: 'Position', value: q.current ? `#${q.queue.length}` : 'Up next', inline: true })
        .setThumbnail(track.thumbnail);

      if (!q.current) playNext(interaction.guildId, client);
      await interaction.editReply({ embeds: [embed] });
    }

    else if (sub === 'skip') {
      const q = getQueue(interaction.guildId);
      if (!q?.current) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
      q.player.stop();
      await interaction.reply('⏭️ Skipped!');
    }

    else if (sub === 'stop') {
      const q = getQueue(interaction.guildId);
      if (!q) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
      q.queue = [];
      q.player.stop();
      q.connection.destroy();
      deleteQueue(interaction.guildId);
      await interaction.reply('⏹️ Stopped and cleared queue.');
    }

    else if (sub === 'queue') {
      const q = getQueue(interaction.guildId);
      if (!q) return interaction.reply({ content: '❌ Queue is empty.', ephemeral: true });
      const list = q.queue.slice(0, 10).map((t, i) => `**${i + 1}.** [${t.title}](${t.url}) — ${t.duration}`).join('\n') || 'Empty';
      const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('🎵 Music Queue')
        .addFields({ name: 'Now Playing', value: q.current ? `[${q.current.title}](${q.current.url})` : 'Nothing' }, { name: `Up Next (${q.queue.length})`, value: list });
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'nowplaying') {
      const q = getQueue(interaction.guildId);
      if (!q?.current) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
      const embed = new EmbedBuilder().setColor(0xff0000).setTitle('🎵 Now Playing')
        .setDescription(`**[${q.current.title}](${q.current.url})**`)
        .setThumbnail(q.current.thumbnail)
        .addFields({ name: 'Duration', value: q.current.duration });
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'pause') {
      const q = getQueue(interaction.guildId);
      if (!q?.player) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
      q.player.pause();
      await interaction.reply('⏸️ Paused.');
    }

    else if (sub === 'resume') {
      const q = getQueue(interaction.guildId);
      if (!q?.player) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
      q.player.unpause();
      await interaction.reply('▶️ Resumed.');
    }

    else if (sub === 'volume') {
      const q = getQueue(interaction.guildId);
      if (!q?.current) return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
      const level = interaction.options.getInteger('level') / 100;
      q.volume = level;
      const resource = q.player._state?.resource;
      if (resource?.volume) resource.volume.setVolume(level);
      await interaction.reply(`🔊 Volume set to **${interaction.options.getInteger('level')}%**`);
    }
  }
};
