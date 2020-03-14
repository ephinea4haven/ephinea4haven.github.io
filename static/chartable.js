$(function () {

    // $('#humar')

    var t = new CharData();


    for(clazz in t.clazz){

        var role = t[clazz].lv;
        for (lv in role) {

            /*
            <tr>
            <th scope="row">1</th>
            <td>Mark</td>
            <td>Otto</td>
            <td>@mdo</td>
        </tr>
             */
            let stat = role[lv];
            var row = "" +
                "<tr>" +
                "<td>" + lv + "</td>" +
                "<td>" + stat[0] + "</td>" +
                "<td>" + stat[1] + "</td>" +
                "<td>" + stat[2] + "</td>" +
                "<td>" + stat[3] + "</td>" +
                "<td>" + stat[4] + "</td>" +
                "<td>" + stat[5] + "</td>" +
                "<td>" + stat[6] + "</td>" +
                "</tr>";

            var id = "#"+clazz;
            $(id).append(row)
        }
    }

    $("#topArrow").click(function(){
        $(document).scrollTop(0);
    })

});