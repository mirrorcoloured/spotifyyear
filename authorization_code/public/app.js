
(function() {

    /**
     * Obtains parameters from the hash of the URL
     * @return Object
     */
    function getHashParams() {
        var hashParams = {};
        var e, r = /([^&;=]+)=?([^&;]*)/g,
            q = window.location.hash.substring(1);
        while ( e = r.exec(q)) {
            hashParams[e[1]] = decodeURIComponent(e[2]);
        }
        return hashParams;
    }

    // get templates from html for later rendering
    const userProfileSource = document.getElementById('user-profile-template')?.innerHTML;
    const userProfileTemplate = Handlebars.compile(userProfileSource);
    const userProfilePlaceholder = document.getElementById('user-profile');

    const oauthSource = document.getElementById('oauth-template')?.innerHTML;
    const oauthTemplate = Handlebars.compile(oauthSource);
    const oauthPlaceholder = document.getElementById('oauth');
    
    const playlistSource = document.getElementById('playlist-template')?.innerHTML;
    const playlistTemplate = Handlebars.compile(playlistSource);
    const playlistPlaceholder = document.getElementById('playlist');

    // get parameters from url
    var params = getHashParams();
    let access_token = params.access_token
    let refresh_token = params.refresh_token
    let error = params.error;
    let admin = params.admin || false;

    if (error) {
        alert('There was an error during the authentication');
    } else {
        if (access_token) {
        // render oauth info
        oauthPlaceholder.innerHTML = oauthTemplate({
            access_token: access_token,
            refresh_token: refresh_token
        });

        // grab user info
        $.ajax({
            url: 'https://api.spotify.com/v1/me',
            headers: {
                'Authorization': 'Bearer ' + access_token
            },
            success: function(response) {
                // hide initial screen and show logged in content
                response['thisYear'] = new Date().getFullYear();
                response['admin'] = admin;
                userProfilePlaceholder.innerHTML = userProfileTemplate(response);
                playlistPlaceholder.innerHTML = playlistTemplate(response);

                hookButtons();

                $('#login').hide();
                $('#loggedin').show();
            }
        });
        } else {
            // render initial screen
            $('#login').show();
            $('#loggedin').hide();
        }

        document.getElementById('obtain-new-token')?.addEventListener('click', function() {
        $.ajax({
            url: '/refresh_token',
            data: {
                'refresh_token': refresh_token
            }
        }).done(function(data) {
            // update access token
            access_token = data.access_token;
            // update tokens in UI
            oauthPlaceholder.innerHTML = oauthTemplate({
                access_token: access_token,
                refresh_token: refresh_token
            });
        });
        }, false);
















        // NEW STUFF

        // https://developer.spotify.com/console/post-playlist-tracks/
        

        function getChosenYear() {
            return document.getElementById('year-input')?.value;
        }
        
        function getUserId() {
            return document.getElementById('user-input')?.value;
        }
        
        function getPlaylistId() {
            return document.getElementById('playlist-input')?.value;
        }

        function showProgressAnimation() {
            document.getElementById('progress-animation')?.classList.remove('hidden');
        }
        
        function hideProgressAnimation() {
            document.getElementById('progress-animation')?.classList.add('hidden');
        }


        function getUserPlaylists (url, playlistItemInfoExtractor, verbose=false) {
            return new Promise(function (resolve, reject) {
                let user_playlists = [];
                getItems(url);
    
                if (verbose) console.log('[getUserPlaylists] Request', url);
                function getItems(url) {
                    let call = $.ajax({
                        url: url,
                        headers: {
                            'Authorization': 'Bearer ' + access_token
                        },
                        success: function(response) {
                            if (verbose) console.log('[getUserPlaylists] Response', response);
                            for (const item of response.items) {
                                if (verbose) console.log(item);
                                user_playlists.push(playlistItemInfoExtractor(item));
                            }
                        }
                    });
                    call.done(function (data, textStatus, jqXHR) {
                        if (data.next) {
                            getItems(data.next);
                        } else {
                            resolve(user_playlists);
                        }
                    })
                    call.fail(function(e) {
                        console.log('[getUserPlaylists] Fail', e);
                        reject(e);
                    })
                }
            })
        }


        function getArtistsInfo (artist_ids, verbose=false) {
            const batch_size = 50;
            const delay_ms = 1000;

            let batches = [];
            for (let i=0; i<artist_ids.length; i+=batch_size) {
                const batch = artist_ids.slice(i, i+batch_size);
                batches.push(batch);
            }
            let all_artist_info = [];

            return new Promise(function (resolve, reject) {
                for (let batch of batches) {
                    const id_string = batch.join(',')
                    const url = `https://api.spotify.com/v1/artists?ids=${id_string}`;
    
                    if (verbose) console.log('[getArtistsInfo] Request', url);
                    let call = $.ajax({
                        url: url,
                        headers: {
                            'Authorization': 'Bearer ' + access_token
                        },
                        success: function(response) {
                            if (verbose) console.log('[getArtistsInfo] Response', response);
                            for (const info of response.artists) {
                                const data = {};
                                data.id = info.id;
                                data.name = info.name;
                                data.popularity = info.popularity;
                                data.followers = info.followers.total;
                                data.genres = info.genres.join(';')
                                all_artist_info.push(data);
                            }

                        }
                    });
                    call.done(function (data, textStatus, jqXHR) {
                        if (all_artist_info.length == artist_ids.length) {
                            resolve(all_artist_info);
                        }
                    })
                    call.fail(function(e) {
                        console.log('[getArtistsInfo] Fail', e);
                        reject(e);
                    })
                    literally_do_nothing(delay_ms);
                }
            })
        }


        function getPlaylistTracks (url, trackItemInfoExtractor, verbose=false) {
            return new Promise(function (resolve, reject) {
                let playlist_tracks = [];
                getItems(url);
    
                if (verbose) console.log('[getPlaylistTracks] Request', url);
                function getItems(url) {
                    let call = $.ajax({
                        url: url,
                        headers: {
                            'Authorization': 'Bearer ' + access_token
                        },
                        success: function(response) {
                            if (verbose) console.log('[getPlaylistTracks] Response', response);
                            for (const item of response.items) {
                                if (verbose) console.log(item);
                                if (item.track == null) {
                                    continue;
                                } else {
                                    playlist_tracks.push(trackItemInfoExtractor(item));
                                }
                            }
                        }
                    });
                    call.done(function (data, textStatus, jqXHR) {
                        if (data.next) {
                            getItems(data.next);
                        } else {
                            resolve(playlist_tracks);
                        }
                    })
                    call.fail(function(e) {
                        console.log('[getPlaylistTracks] Fail', e);
                        reject(e);
                    })
                }
            })
        }


        function getTrackFeatures (track_id, verbose=false) {
            const url = `https://api.spotify.com/v1/audio-features/${track_id}`;
            if (verbose) console.log('[getTrackFeatures] Request', url);
            return new Promise(function (resolve, reject) {
                let features = {};
                let call = $.ajax({
                    url: url,
                    headers: {
                        'Authorization': 'Bearer ' + access_token
                    },
                    success: function(response) {
                        if (verbose) console.log('[getTrackFeatures] Response', response);
                        for (const feature of [
                            'id',
                            'acousticness',
                            'danceability',
                            'duration_ms',
                            'energy',
                            'instrumentalness',
                            'key',
                            'liveness',
                            'loudness',
                            'mode',
                            'speechiness',
                            'tempo',
                            'time_signature',
                            'valence',
                        ]) {
                            features[feature] = response[feature];
                        }
                    }
                });
                call.done(function (data, textStatus, jqXHR) {
                    resolve(features);
                })
                call.fail(function(e) {
                    console.log('[getTrackFeatures] Fail', e);
                    reject(e);
                })
            })
        }

        function getTracksFeatures (track_ids, verbose=false) {
            return new Promise(function (resolve, reject) {
                let features = [];

                const id_string = track_ids.join(',')
                const url = `https://api.spotify.com/v1/audio-features?ids=${id_string}`;

                if (verbose) console.log('[getTracksFeatures] Request', url);
                let call = $.ajax({
                    url: url,
                    headers: {
                        'Authorization': 'Bearer ' + access_token
                    },
                    success: function(response) {
                        if (verbose) console.log('[getTracksFeatures] Response', response);
                        for (const response_track of response.audio_features) {
                            if (response_track == null) continue;
                            let track_features = {};
                            for (const feature of [
                                'id',
                                'acousticness',
                                'danceability',
                                'duration_ms',
                                'energy',
                                'instrumentalness',
                                'key',
                                'liveness',
                                'loudness',
                                'mode',
                                'speechiness',
                                'tempo',
                                'time_signature',
                                'valence',
                            ]) {
                                track_features[feature] = response_track[feature] || null;
                            }
                            features.push(track_features);
                        }
                    }
                });
                call.done(function (data, textStatus, jqXHR) {
                    resolve(features);
                })
                call.fail(function(e) {
                    console.log('[getTracksFeatures] Fail', e);
                    reject(e);
                })
            })
        }


        function createPlaylist(name, description, playlist_public) {
            return new Promise(function (resolve, reject) {
                const user_id = getUserId();
                const url = `https://api.spotify.com/v1/users/${user_id}/playlists`;
    
                console.log('[createPlaylist] Request', url);
                let call = $.ajax({
                    type: "POST",
                    url: url,
                    headers: {
                        'Authorization': 'Bearer ' + access_token
                    },
                    data: JSON.stringify({
                        name: name,
                        description: description,
                        public: playlist_public,
                    }),
                    success: function(response) {
                        console.log('[createPlaylist] made', name, 'Response', response);
                    }
                });
                call.done(function (data, textStatus, jqXHR) {
                    resolve(data)
                })
                call.fail(function(e) {
                    console.log('[createPlaylist] Fail', e);
                    reject(e);
                })
            })
        }


        function addTracksToPlaylist(playlist_id, track_uris, position=0) {
            return new Promise(function (resolve, reject) {
                const url = `https://api.spotify.com/v1/playlists/${playlist_id}/tracks`;
    
                console.log('[addTracksToPlaylist] Request', url);
                let call = $.ajax({
                    type: "POST",
                    url: url,
                    headers: {
                        'Authorization': 'Bearer ' + access_token
                    },
                    data: JSON.stringify({
                        uris: track_uris,
                        position: position,
                    }),
                    success: function(response) {
                        console.log('[addTracksToPlaylist] Response', response);
                    }
                });
                call.done(function (data, textStatus, jqXHR) {
                    resolve(data)
                })
                call.fail(function(e) {
                    console.log('[addTracksToPlaylist] Fail', e);
                    reject(e);
                })
            })
        }

        function hookButtons() {
            document.getElementById('get-playlists')?.addEventListener('click', btnGetUserPlaylists);
            document.getElementById('dl-playlists')?.addEventListener('click', btnDownloadUserPlaylists);
            document.getElementById('get-track-info')?.addEventListener('click', btnGetTrackInfo);
            document.getElementById('get-playlist-data')?.addEventListener('click', btnGetPlaylistTracks);
            document.getElementById('dl-playlist-data')?.addEventListener('click', btnDownloadPlaylistTracks);
            document.getElementById('get-detailed-playlist-info')?.addEventListener('click', btnGetPlaylistDetails);
            document.getElementById('dl-detailed-playlist-info')?.addEventListener('click', btnDownloadPlaylistDetails);
            document.getElementById('download-all-stats')?.addEventListener('click', downloadAllMyPlaylistDetails);
            document.getElementById('create-new-this-year-playlist')?.addEventListener('click', createReleasedThisYearPlaylist);

            document.getElementById('btn-test')?.addEventListener('click', funcTEST);
        }

        // TODO recommendations?
        // https://developer.spotify.com/documentation/web-api/reference/#/operations/get-recommendations

        function btnGetUserPlaylists() {
            showProgressAnimation();
            pullUserPlaylists().then(function (result) {
                document.getElementById('playlist-results')?.appendChild(loo_to_html(result));
                hideProgressAnimation();
            })
        }
        
        function btnDownloadUserPlaylists() {
            showProgressAnimation();
            pullUserPlaylists().then(function (result) {
                download_file(json_to_csv(result), 'playlists.csv');
                hideProgressAnimation();
            })
        }
        
        function btnGetPlaylistTracks() {
            showProgressAnimation();
            const playlist_id = getPlaylistId();
            pullPlaylistTracks(playlist_id).then(function (result) {
                document.getElementById('playlist-response')?.appendChild(loo_to_html(result));
                hideProgressAnimation();
            });
        }
        
        function btnDownloadPlaylistTracks() {
            showProgressAnimation();
            const playlist_id = getPlaylistId();
            pullPlaylistTracks(playlist_id).then(function (result) {
                download_file(json_to_csv(result), `${playlist_id}_tracks.csv`);
                hideProgressAnimation();
            });
        }
        
        function btnGetPlaylistDetails() {
            showProgressAnimation();
            const playlist_id = getPlaylistId();
            pullPlaylistDetails(playlist_id).then(function (args) {
                const [trackdetails, artist_info] = args;
                document.getElementById('playlist-response')?.appendChild(loo_to_html(artist_info));
                document.getElementById('playlist-response')?.appendChild(loo_to_html(trackdetails));
                hideProgressAnimation();
            })
        }
        
        function btnDownloadPlaylistDetails() {
            showProgressAnimation();
            const playlist_id = getPlaylistId();
            pullPlaylistDetails(playlist_id).then(function (args) {
                const [trackdetails, artist_info] = args;
                download_file(json_to_csv(trackdetails), `${playlist_id}_trackdetails.csv`);
                download_file(json_to_csv(artist_info), `${playlist_id}_artistdetails.csv`);
                hideProgressAnimation();
            })
        }

        function btnGetTrackInfo() {
            showProgressAnimation();
            const track_id = document.getElementById('track-input')?.value;
            getTrackFeatures(track_id).then(function (result) {
                document.getElementById('track-response')?.appendChild(loo_to_html([result]));
                hideProgressAnimation();
            })
        }
        








        
        function funcTEST() {
            const user_id = getUserId();

            // const ft = getTracksFeatures([
            //     '6Wqiltjfk4Jhb2WKmIFVkT',
            //     '0uuqx1tCpNBFEMOdlcWb3y',
            //     '3GU9knCMGMb7ZaylfVBdKi',
            // ]);
            // console.log('ft', ft);

            const ai = getArtistsInfo([
                "2CIMQHirSU0MQqyYHq0eOx",
                "57dN52uHvrHOxijzpIgu3E",
                "1vCWHaC5f2uS3yhpwWbIA6",
            ], true)
            console.log('ai', ai);

            // getUserPlaylists(`https://api.spotify.com/v1/users/${user_id}/playlists`, item => {}, true);

            // getPlaylistTracks(`https://api.spotify.com/v1/me/tracks`, item => {}, true);

            // addTrackToPlaylist('6tXdyZYOAt6RBuQXIZ2989', "spotify:track:0cgMGEUmhcbIMhUf5bGxEv");

            // getTrackFeatures('60pbtX6C3anmLO9EIpKr8u', true)
            // .then(function (features) {
            //     console.log('feat', features);
            // })
        }


        // pull all songs from my playlists and liked songs and extract audio features analysis
        function downloadAllMyPlaylistDetails() {
            const user_id = getUserId();
            const batch_size = 100;
            const delay_ms = 2000;

            getUserPlaylists(`https://api.spotify.com/v1/users/${user_id}/playlists`, function(item) {
                return {
                    id: item.id,
                    href: item.href,
                    name: item.name,
                    owner: item.owner.display_name,
                }
            })
            .then(function (result_playlists) {
                let working_playlists = result_playlists.filter(i => (i.owner == user_id)); // only look at my playlists
                working_playlists.push({name: 'Liked Songs', href: `https://api.spotify.com/v1/me`}) // add my liked songs
                console.log('Checking playlists', working_playlists);

                let track_accumulator = [];
                let expecting_responses = working_playlists.length;

                return new Promise(function (resolve, reject) {
                    for (const result_playlist of working_playlists) {
                        const url = result_playlist.href + "/tracks";
                        getPlaylistTracks(url, function (item) {
                            return {
                                playlist: result_playlist.name,
                                id: item.track.id,
                                name: item.track.name,
                                artist: item.track.artists.map(artist => artist.name).join(';'),
                                album: item.track.album.name,
                                release: item.track.album.release_date,
                                duration: item.track.duration_ms / 60000,
                                explicit: item.track.explicit,
                                popularity: item.track.popularity,
                            }
                        })
                        .then(function (results) {
                            for (const track_info of results) {
                                track_accumulator.push(track_info)
                            }
                            if (--expecting_responses === 0) {
                                resolve(track_accumulator);
                            }
                        })
                    }
                })
            })
            .then(function (tracks) {
                let unique_track_ids = [];
                for (const track of tracks) {
                    if (!unique_track_ids.includes(track.id)) {
                        unique_track_ids.push(track.id);
                    }
                }

                let all_analysis = [];
                let batches = [];
                for (let i=0; i<unique_track_ids.length; i+=batch_size) {
                    const batch = unique_track_ids.slice(i, i+batch_size);
                    batches.push(batch);
                }
                let expecting_responses = batches.length;

                console.log(`Found ${tracks.length} tracks, ${unique_track_ids.length} unique. Analyzing in ${batches.length} batches (${batches.length * delay_ms / 1000} s)`);

                return new Promise(function (resolve, reject) {
                    let i = 0;
                    for (const batch of batches) {
                        console.log(`${i++} / ${batches.length}`);
                        getTracksFeatures(batch, true)
                        .then(function(results) {
                            all_analysis = all_analysis.concat(results)
                            if (--expecting_responses === 0) {
                                resolve([tracks, all_analysis])
                            }
                        })
                        literally_do_nothing(delay_ms);
                    }
                })
            })
            .then(function (args) {
                const [tracks, all_analysis] = args;
                console.log(`Downloading tracks and analysis (${tracks.length}, ${all_analysis.length})`);
                console.log(args);
                download_file(json_to_csv(tracks), 'tracks.csv');
                download_file(json_to_csv(all_analysis), 'analysis.csv');
            })
        }


        // look in all my playlists and liked songs for songs that were released this year and put them all in a new playlist, sorted by popularity
        function createReleasedThisYearPlaylist() {
            const user_id = getUserId();
            const year = getChosenYear();
            const playlist_prefix = 'my-released-';
            
            
            getUserPlaylists(`https://api.spotify.com/v1/users/${user_id}/playlists`, function(item) {
                return {
                    href: item.href,
                    name: item.name,
                    owner: item.owner.display_name,
                }
            })
            .then(function (result_playlists) {
                let working_playlists = result_playlists.filter(i => (i.owner == user_id && i.name.indexOf(playlist_prefix) == -1)); // only look at my playlists
                working_playlists.push({href: `https://api.spotify.com/v1/me`}) // add my liked songs

                let track_accumulator = [];
                let expecting_responses = working_playlists.length;

                return new Promise(function (resolve, reject) {
                    for (const result of working_playlists) {
                        const url = result.href + "/tracks";
                        getPlaylistTracks(url, function (item) {
                            return {
                                // id: item.track.id,
                                name: item.track.name,
                                release: item.track.album.release_date,
                                uri: item.track.uri,
                                popularity: item.track.popularity,
                            }
                        })
                        .then(function (results) {
                            for (const track_info of results) {
                                if (track_info.release.slice(0, 4) == year) {
                                    track_accumulator.push(track_info)
                                }
                            }
                            if (--expecting_responses === 0) {
                                resolve(track_accumulator);
                            }
                        })
                    }
                })
            })
            .then(function (new_tracks) {
                console.log('found', new_tracks.length, 'new tracks this year');

                new_tracks.sort((a, b) => a.popularity - b.popularity);
                
                let batches = [];
                const batch_size = 50;
                for (let i=0; i<new_tracks.length; i+=batch_size) {
                    const batch = new_tracks.slice(i, i+batch_size);
                    batches.push(batch);
                }

                createPlaylist(`${playlist_prefix}${year}`, `Newly added songs in ${year}. Created ${new Date()}`, false)
                .then(function (result_playlist) {
                    let i = 0;
                    for (let batch of batches) {
                        console.log('adding batch', batch);
                        addTracksToPlaylist(result_playlist.id, batch.map(i => i.uri), i*batch_size);
                        literally_do_nothing(2000);
                        i++;
                    }
                })
            })
        }
        
        
        function pullUserPlaylists() {
            const user_id = getUserId();
            return getUserPlaylists(`https://api.spotify.com/v1/users/${user_id}/playlists`, function(item) {
                return {
                    name: item.name,
                    id: item.id,
                    length: item.tracks.total,
                    public: item.public,
                    collaborative: item.collaborative,
                    owner: item.owner.display_name,
                }
            })
        }
        

        function pullPlaylistTracks(playlist_id) {
            const url = playlist_id == "liked" ? `https://api.spotify.com/v1/me/tracks` : `https://api.spotify.com/v1/playlists/${playlist_id}/tracks`;
            return getPlaylistTracks(url, function(item) {
                return {
                    id: item.track.id,
                    href: item.track.href,
                    name: item.track.name,
                    artist: item.track.artists.map(e => e.name).join(';'),
                    added: item.added_at,
                    popularity: item.track.popularity,
                    release: item.track.album.release_date,
                }
            })
        }

        
        function pullPlaylistDetails(playlist_id) {
            const batch_size = 100;
            const delay_ms = 2000;

            const url = playlist_id == "liked" ? `https://api.spotify.com/v1/me/tracks` : `https://api.spotify.com/v1/playlists/${playlist_id}/tracks`;

            // get tracks in playlist
            return getPlaylistTracks(url, function(item) {
                return {
                    id: item.track.id,
                    href: item.track.href,
                    name: item.track.name,
                    artist: item.track.artists.map(artist => artist.name).join(';'),
                    artist_ids: item.track.artists.map(artist => artist.id),
                    album: item.track.album.name,
                    duration: item.track.duration_ms / 60000,
                    added: item.added_at,
                    popularity: item.track.popularity,
                    explicit: item.track.explicit,
                    release: item.track.album.release_date,
                }
            })
            // get features of each unique track
            .then(function (tracks) {
                let unique_track_ids = [];
                for (const track of tracks) {
                    if (!unique_track_ids.includes(track.id)) {
                        unique_track_ids.push(track.id);
                    }
                }

                let all_analysis = [];
                let batches = [];
                for (let i=0; i<unique_track_ids.length; i+=batch_size) {
                    const batch = unique_track_ids.slice(i, i+batch_size);
                    batches.push(batch);
                }
                let expecting_responses = batches.length;

                console.log(`Found ${tracks.length} tracks, ${unique_track_ids.length} unique. Analyzing in ${batches.length} batches (${batches.length * delay_ms / 1000} s)`);

                return new Promise(function (resolve, reject) {
                    let i = 0;
                    for (const batch of batches) {
                        console.log(`${i++} / ${batches.length}`);
                        getTracksFeatures(batch, true)
                        .then(function(results) {
                            all_analysis = all_analysis.concat(results)
                            if (--expecting_responses === 0) {
                                resolve([tracks, all_analysis])
                            }
                        })
                        literally_do_nothing(delay_ms);
                    }
                })
            })
            // merge features into track info and get artist details
            .then(function (args) {
                const [tracks, all_analysis] = args;
                const unique_artists = [];
                for (let i=0; i<tracks.length; i++) {
                    for (let j=0; j<all_analysis.length; j++) {
                        if (tracks[i].id == all_analysis[j].id) {
                            for (let [key, val] of Object.entries(all_analysis[i])) {
                                tracks[i][key] = val;
                            }
                            break
                        }
                    }
                    for (let artist_id of tracks[i].artist_ids) {
                        if (!unique_artists.includes(artist_id)) {
                            unique_artists.push(artist_id);
                        }

                    }
                    delete tracks[i].artist_ids
                }
                return new Promise(function (resolve, reject) {
                    getArtistsInfo(unique_artists, true)
                    .then(function (artist_info) {
                        resolve([tracks, artist_info])
                    })
                })
            })
        }
    }











    function download_file(export_data, filename) {
        const blob = new Blob([export_data], {type: 'plain/text'});
        let a = document.createElement('a');
        a.download = filename;
        a.href = window.URL.createObjectURL(blob);
        a.click();
    }

    function json_to_csv(items) {
        const replacer = (key, value) => value === null ? '' : value // specify how you want to handle null values here
        const header = Object.keys(items[0])
        const csv = [
            header.join(','), // header row first
            ...items.map(row => header.map(fieldName => JSON.stringify(row[fieldName], replacer)).join(','))
        ].join('\r\n')
        return csv;
    }

    function loo_to_html(loo) {
        let headers = [];
        // get all headers
        for (let o of loo) {
            for (let k of Object.keys(o)) {
                if (!(headers.includes(k))) {
                    headers.push(k);
                }
            }
        }
        let e_tbl = document.createElement("table");
        // add headers
        let e_row = document.createElement("tr");
        for (let header of headers) {
            let e_header = document.createElement("th");
            e_header.innerHTML = header;
            e_row.appendChild(e_header);
        }
        e_tbl.appendChild(e_row);
        // add rows
        for (let i = 0; i < loo.length; i++) {
            let e_row = document.createElement("tr");
            for (let header of headers) {
                let e_data = document.createElement("td");
                e_data.innerHTML = loo[i][header];
                e_row.appendChild(e_data);
            }
            e_tbl.appendChild(e_row);
        }
        
        return e_tbl;
    }

    function literally_do_nothing(milliseconds) {
        const start = new Date();
        let now = new Date();
        while (now - start < milliseconds) {
            now = new Date();
        }
    }
})();

