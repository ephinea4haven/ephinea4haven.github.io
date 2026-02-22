var imgDirectory = "static/img/";
var pngExtension = ".png";
var sectionIdList = ['Viridia', 'Greenill', 'Skyly', 'Bluefull',
    'Purplenum', 'Pinkal', 'Redria', 'Oran',
    'Yellowboze', 'Whitill'];
var textFieldList = ['#tf0', '#tf1', '#tf2', '#tf3', '#tf4', '#tf5',
    '#tf6', '#tf7', '#tf8', '#tf9', '#tf10', '#tf11', '#tf12'];

var img = ['img0', 'img1', 'img2', 'img3', 'img4', 'img5',
    'img6', 'img7', 'img8', 'img9', 'img10', 'img11', 'img12'];

var magicNumberList = [0, 1, 2, 9, 3, 11, 4, 5, 10, 6, 7, 8];

function processName() {
    var inputName = document.getElementById("name"),
        flag = 0,
        sectionIdValue = 0;

    var unicodeLetterAMacron = 0x100;      //Decimal 256
    var unicodeHalfwidthFullstop = 0xFF61; //Decimal 65377
    var unicodeHalfwidthKanaMu = 0xFF91;   //Decimal 65425
    for (var i = 0; i < inputName.value.length; i++) {
        sectionIdValue += inputName.value.charCodeAt(i);
        if (inputName.value.charCodeAt(i) >= unicodeLetterAMacron &&
            inputName.value.charCodeAt(i) < unicodeHalfwidthFullstop) {
            if (flag != 2) {
                flag = 2;
                sectionIdValue += 83;
            }
        } else if (inputName.value.charCodeAt(i) <= unicodeHalfwidthKanaMu) {
            if (flag != 1) {
                flag = 1;
                sectionIdValue += 45;
            }
        }
    }
    return (sectionIdValue);
}

function isStrAscii(str) {
    var currentChar = 0;
    var asciiTilde = 126;
    var asciiSpace = 32;
    for (var i = 0; i <= str.length; i++) {
        currentChar = str.charCodeAt(i);
        if ((currentChar > asciiTilde) || (currentChar < asciiSpace)) {
            return false;
        }
    }
    return true;
}

function openCalcMode(modeName, elmnt) {
    var i, calc;
    calc = document.getElementsByClassName("calc");
    for (i = 0; i < calc.length; i++) {
        calc[i].style.display = "none";
    }

    document.getElementById(modeName).style.display = "block";
}

document.querySelector('#name').addEventListener('input', function () {

    var inputElement = document.getElementById("name");
    if ((inputElement.value.length !== 0) && (inputElement.value.length <= 12) && (isStrAscii(inputElement.value) === true)) {

        document.querySelector('#tf0').textContent = sectionIdList[(processName() + 5) % 10];

        document.getElementById("img0").src = imgDirectory + sectionIdList[(processName() + 5) % 10] + pngExtension;
    } else {
        document.querySelector('#tf0').textContent = "N/A";

        document.getElementById("img0").src = 'static/img/Impossible.png';
    }

    if ((inputElement.value.length !== 0) && (inputElement.value.length <= 10)) {

        for (var i = 1; i <= 12; i++) {
            document.querySelector(textFieldList[i]).textContent = sectionIdList[(processName() + magicNumberList[i - 1]) % 10];
            document.getElementById(img[i]).src = imgDirectory + sectionIdList[(processName() + magicNumberList[i - 1]) % 10] + pngExtension;
        }
    } else {
        for (var i = 1; i <= 12; i++) {
            document.querySelector(textFieldList[i]).textContent = 'N/A';
            document.getElementById(img[i]).src = 'static/img/Impossible.png';
        }

    }
});

// Get the element with id="defaultOpen" and click on it
document.getElementById("defaultOpen").click();