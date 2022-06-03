function displayItemCodes() {
    let itemCodes;
    (this.lang === "JA")
        ? itemCodes = ItemCodes_JA()
        : itemCodes = ItemCodes();

    console.log(itemCodes);

    let id = document.getElementById("data");
    id.innerHTML = '';

    let tbody = tag("tbody");

    if (Object.keys(itemCodes).length !== 0) {
        for (let key in itemCodes) {
            tbody = appendChilds(tbody, tr(td(textNode("0x" + Number(key).toString(16).padStart(6, 0).toUpperCase())),
                td(textNode(itemCodes[key]))));
        }
    }

    id.appendChild(data_window_creater(tbody, "ITEM CODES"));
    setCursorAudio();
}

function displayCharacter(character) {
    let id = document.getElementById("data");
    id.innerHTML = '';

    // sectionIDのイメージタグ
    const sectionid_image = tag("img", "class::sectionid_image", `src::./resources/images/icon/sectionid/${character.SectionID.toLowerCase()}.png`);
    const tbody = tag("tbody", tr(td(textNode(`SLOT : ${character.Slot}`))),
        tr(td(textNode(`NAME : ${character.Name}`))),
        tr(td(textNode(`GUILD CARD : ${character.GuildCardNumber}`))),
        tr(td(textNode(`CLASS : ${character.Class}`))),
        tr(td("class::sectionid", tag("div", "class::sectionid_text", textNode("SECTION ID : ")),
            sectionid_image,
            tag("div", "class::sectionid_text", textNode(character.SectionID)))),
        tr(td(textNode(`LEVEL : ${character.Level}`))),
        tr(td(textNode(`EP1 CHALLENGE : ${character.Ep1Progress}`))),
        tr(td(textNode(`EP2 CHALLENGE : ${character.Ep2Progress}`))));

    id.appendChild(data_window_creater(tbody, "CHARACTER"));

    displayInventory(character.Inventory[this.lang], "INVENTORY");
    displayInventory(character.Bank[this.lang], "BANK");
}

function displayShareBank(shareBank, title) {
    let id = document.getElementById("data");
    id.innerHTML = '';
    displayInventory(shareBank.ShareBank[this.lang], "SHARE BANK")
}

function displayInventory(inventory, title, mode) {
    let id = document.getElementById("data");

    let tbody = tag("tbody");

    // イベントリがからの場合、NO ITEMと表示
    if (inventory.length == 0) tbody.appendChild(tr(td(textNode("NO ITEM"))));

    if (inventory.length >= 0) {
        // インベントにアイテムがある場合
        for (let i in inventory) {
            let td = tag("td", "class::data_td_item");
            if (inventory[i][1]["type"] == Config.ItemType.MAG) {
                td = appendChilds(td, textNode(inventory[i][1]["display_front"]),
                    tag("div", "class::magcolor", `style::background-color: ${inventory[i][1]["rgb"]};}`),
                    textNode(inventory[i][1]["display_end"]));
            } else {
                td = appendChilds(td, textNode(inventory[i][1]["display"]));
            }

            let tr = tag("tr", td);

            // スロット列作成
            if (mode == "allItems") {
                let slot = tag("td", "class::data_td_slot", textNode(`Slot: ${inventory[i][2]}`));
                tr.appendChild(slot);
            }
            tbody.appendChild(tr);
        }
    }

    id.appendChild(data_window_creater(tbody, title, inventory.length));
    setCursorAudio();
}

function displayPager() {
    const characters = this.characters;
    const shareBanks = this.shareBanks;
    const allItems = this.allItems;

    let id = document.getElementById("pager");
    id.innerHTML = '';

    // キャラクターのページを表示する
    if (Object.keys(characters).length !== 0) {
        for (let i in characters) {
            let button = tag("button", `id::pagecharacter${i}`, "class::page", `name::${i}`, `onclick::clickPage("character", name)`, `innerText::${characters[i].Slot}:${characters[i].Name}`);
            id.appendChild(button);
        }
    }

    // 共有倉庫のページを表示する
    if (Object.keys(shareBanks).length !== 0) {
        for (let i in shareBanks) {
            let button = tag("button", `id::pageshareBank${i}`, "class::page", `name::${i}`, `onclick::clickPage("shareBank", name)`, "innerText::ShareBank");
            id.appendChild(button);
        }
    }

    // 全アイテムのページを表示する
    if (Object.keys(allItems).length !== 0) {
        let button = tag("button", `id::pageallItemsdefault`, "class::page", `name::default`, `onclick::clickPage("allItems", name)`, "innerText::AllItems");
        id.appendChild(button);
    }
}

function displayNotification() {
    console.log("====== notification ======");
    console.log(notification());

    const notifications = notification();
    let div = document.getElementById("notification");
    let tbody = tag("tbody");
    for (const notification of notifications) {
        let text = document.createElement("td");
        for (const line of notification["text"]) {
            if (line.match(/linker/)) {
                const linker = line.split("||");
                text.appendChild(tag("a", `href::${linker[2]}`, `target::_blank`, textNode(linker[1])));
            } else {
                let p = tag("p");
                if (notification["status"] === "resolved") p.appendChild(tag("del", textNode(line)));
                else p.textContent = line;
                text.appendChild(p);
            }
        }
        tbody.appendChild(tag("tr", td(textNode(notification["date"])),
            td(`class::${notification["status"]}`),
            text));
    }
    div.appendChild(tag("table", tbody));
}

function data_title_creater(title) {
    return tag("div", "class::data_title", tag("div", "class::data_title_left"),
        tag("h2", "class::data_title_body", textNode(title)),
        tag("div", "class::data_title_right"));
}

function data_number_creater(number) {
    return tag("div", "class::data_number", tag("div", "class::data_number_left"),
        tag("div", "class::data_number_body", textNode(`${number}`)),
        tag("div", "class::data_number_right"));
}

function data_window_creater(tbody, title, number) {
    //数値がある場合、数値を表示ブロックを作成
    const data_title_wrap = (number !== undefined) ? tag("div", "class::data_title_wrap", data_title_creater(title), data_number_creater(number))
        : tag("div", "class::data_title_wrap", data_title_creater(title));

    return tag("div", "class::data_window", "id::data_window", data_title_wrap,
        tag("div", "class::data_header"),
        tag("table", "class::data_body", "class::data_cursor", tbody),
        tag("div", "class::data_footer"));
}

function tag(tagName, args) {
    let tag = document.createElement(tagName);
    for (let i = 1; i < arguments.length; i++) {
        tag = createAttribute(tag, arguments[i]);
    }
    return tag;
}

function appendChilds(tag, childs) {
    for (let i = 1; i < arguments.length; i++) {
        tag.appendChild(arguments[i]);
    }
    return tag;
}

function textNode(text) {
    return document.createTextNode(text);
}

function div(args) {
    let tag = document.createElement("table");
    for (const attribute of arguments) {
        tag = createAttribute(tag, attribute);
    }
    return tag;
}

function table(args) {
    let tag = document.createElement("table");
    for (const attribute of arguments) {
        tag = createAttribute(tag, attribute);
    }
    return tag;
}

function tr(td) {
    let tag = document.createElement("tr");
    for (const attribute of arguments) {
        tag.appendChild(attribute);
    }
    return tag;
}

function td(args) {
    let tag = document.createElement("td");
    for (const attribute of arguments) {
        tag = createAttribute(tag, attribute);
    }
    return tag;
}

function createAttribute(tag, attribute) {
    if (typeof attribute === "string") {
        const tmp = attribute.split("::");
        if (tmp[0] === "class") tag.classList.add(tmp[1]);
        else if (tmp[0] === "innerText") tag.innerText = tmp[1];
        else if (tmp[0] === "style") tag.style = tmp[1];
        else if (tmp[0] === "src") tag.src = tmp[1];
        else tag.setAttribute(tmp[0], tmp[1]);
    } else {
        tag.appendChild(attribute);
    }
    return tag;
}
