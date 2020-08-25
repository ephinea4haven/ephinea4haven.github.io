// javascript-obfuscator index.js index.js.map --output  index.min.js
function buff() {
    // 2019-09-22 rare rate()
    const epoch = new Date(2019, 9 - 1, 22)
    epoch.setHours(8, 0, 0, 0);
    epoch.setTime(epoch.getTime() /*+ epoch.getTimezoneOffset() * 60 * 1000*/)

    const now = new Date();
    let current = now.getTime();
    let offset = parseInt(((now.getTime() - epoch.getTime()) / (24 * 60 * 60 * 1000)) / 7 % 4)

    $('#buf li').each(function (idx, val) {
        const id = $(this).attr("id");
        const matches = $(this).text().match(/\d+/g);

        // 2020 周年
        const anniversaryEventEndDate = new Date(2020, 9 - 1, 14).getTime();
        if (+current <= +anniversaryEventEndDate) {
            $(this).css({'color': 'red', 'font-weight': 'bolder'});
            if(id === "1" || id === "0"){
                $(this).text($(this).text().replace(/\d+/, +matches[0] + 10));
            }
            if(id === "3" ){
                $(this).text($(this).text().replace(/\d+/, +matches[0] + 20));
            }
            if (id === "2") {
                $(this).text($(this).text().replace(/\d+/, +matches[0] + 50));
            }
        } else {
            if (offset === parseInt(id)) {
                $(this).css({'color': 'red', 'font-weight': 'bolder'});

                // 2020 圣诞
                var christEventEndDate = new Date(2020, 1 - 1, 13).getTime();
                if (+current <= +christEventEndDate) {

                    $(this).text($(this).text().replace(/\d+/, (+matches[0]) * 2));
                }

                // 2020 复活节
                var easterEventEndDate = new Date(2020, 5 - 1, 10).getTime();
                if (+current <= +easterEventEndDate) {
                    $(this).text($(this).text().replace(/\d+/, (+matches[0]) * 2));
                }
            }

            if ((+offset + 1) % 4 === parseInt(id)) {
                $(this).css({'color': 'green', 'font-weight': 'bolder'});
            }
        }
    })
}

// calculate the time of the future
function GetInternetTime() {
    // get date in UTC/GMT
    var date = new Date();
    var hours = date.getUTCHours();
    var minutes = date.getUTCMinutes();
    var seconds = date.getUTCSeconds();

    // add hour to get time in Switzerland
    hours = (hours === 23) ? 0 : hours + 1;

    // time in seconds
    var timeInSeconds = (((hours * 60) + minutes) * 60) + seconds;

    // there are 86.4 seconds in a beat
    var secondsInABeat = 86.4;

    // calculate beats to two decimal places
    // var beats = parseInt(timeInSeconds / secondsInABeat);
    var beats = Math.abs(timeInSeconds / secondsInABeat).toFixed(2);

    if (parseInt(beats / 100) % 2 === 0) {
        var len = beats.toString().length;
        while (len++ < 3) {
            beats = '0' + beats;
        }
        beats = '<span style="color: #47a447; font-weight: bolder">' + '@' + beats + '</span>'

        $('#hp-span').css({'color': 'green', 'font-weight': 'bold'});
    } else {
        beats = '<span style="font-weight: bolder">@' + beats + '</span>'

        $('#hp-span').css('color', '')
    }

    // update page
    $('#swatchTime').html(beats);
}

function pad0(unit, base) {
    if (!!!base) {
        base = 10;
    }

    if (base === 10) {
        if (unit < 10) {
            unit = '0' + unit;
        }
    } else if (base === 100) {
        if (unit === 0) {
            unit = '000'
        } else if (unit < 10) {
            unit = '00' + unit;
        } else if (unit < 100) {
            unit = '0' + unit;
        }
    }

    return unit;
}


/*
規格
以Swatch總部（位於瑞士比爾市）的時間為基準時間，稱為「比爾標準時間（Biel Mean Time，縮寫為BMT）」，該地時間相當於中歐時區，也就是UTC+1。
一律改採計算簡便的10進制，而非傳統的12進制及60進制混用。
將原來的一天24小時劃分為1000個等份，各等份稱為一個「.Beat」（拍／角刻），因此一個Beat相當於86.4秒（=1分26.4秒）。另有一輔助單位「.cBeat」（分拍／毫刻），為Beat的1/100，即0.864秒。
一天的起始時間（UTC+1時間的午夜0:00）記為「@000」，結束時間為「@999」，且皆以BMT為準，不像傳統時制有時區之別。因此除了傳統上與BMT同時區的地區之外，各地傳統的午夜0:00都不是@000。
 */
function getBeatPeriod(start, end, even) {
    var d1 = new Date();
    d1.setHours(0, 0, 0, 0);
    d1.setTime(d1.getTime() + start * 86400 + 7 * 60 * 60 * 1000);

    var d2 = new Date();
    d2.setHours(0, 0, 0, 0);
    d2.setTime(d2.getTime() + (end + 1) * 86400 + 7 * 60 * 60 * 1000 - 1000);


    var raw = pad0(d1.getHours()) + ':' + pad0(d1.getMinutes()) + ':' + pad0(d1.getSeconds())
        + ' ~ ' + pad0(d2.getHours()) + ':' + pad0(d2.getMinutes()) + ':' + pad0(d2.getSeconds())

    if (even === undefined) {
        even = true;
    }

    raw = pad0(start, 100) + ' ~ ' + pad0(end, 100) + ' : ' + raw;

    if (even) {
        return '<span style="color: #47a447; ">' + raw + '</span>'
    }

    return raw;
}

$(function () {
    GetInternetTime();
    setInterval(GetInternetTime, 1000);

    buff();

    var beat_even_period = "<ul>";
    beat_even_period += "<li>" + getBeatPeriod(0, 99);
    beat_even_period += "<li>" + getBeatPeriod(100, 199, false);
    beat_even_period += "<li>" + getBeatPeriod(200, 299);
    beat_even_period += "<li>" + getBeatPeriod(300, 399, false);
    beat_even_period += "<li>" + getBeatPeriod(400, 499);
    beat_even_period += "<li>" + getBeatPeriod(500, 599, false);
    beat_even_period += "<li>" + getBeatPeriod(600, 699);
    beat_even_period += "<li>" + getBeatPeriod(700, 799, false);
    beat_even_period += "<li>" + getBeatPeriod(800, 899);
    beat_even_period += "<li>" + getBeatPeriod(900, 999, false);
    beat_even_period += "</ul>";

    $('#beat_even_period').html(beat_even_period);
});