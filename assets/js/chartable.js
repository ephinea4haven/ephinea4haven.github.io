'use strict';

$(function () {
    const data = new CharData();

    for (const [clazz, levels] of Object.entries(data)) {
        if (!levels.lv) continue;

        for (const [lv, stat] of Object.entries(levels.lv)) {
            const row = `<tr>
                <td>${lv}</td>
                <td>${stat[0]}</td>
                <td>${stat[1]}</td>
                <td>${stat[2]}</td>
                <td>${stat[3] / 10}</td>
                <td>${stat[4]}</td>
                <td>${stat[5]}</td>
                <td>${stat[6]}</td>
            </tr>`;
            $(`#${clazz}`).append(row);
        }
    }

    $('#topArrow').click(function () {
        $(document).scrollTop(0);
    });
});
