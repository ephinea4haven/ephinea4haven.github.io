var Simulator = function() {
    var a = document.location;
    this.loc = a.protocol + "//" + a.host + a.pathname;
    this.stars = ['<span class="rare1">☆☆☆☆☆☆☆☆☆</span><span class="rare2">☆☆☆</span>', '<span class="rare1">★☆☆☆☆☆☆☆☆</span><span class="rare2">☆☆☆</span>', '<span class="rare1">★★☆☆☆☆☆☆☆</span><span class="rare2">☆☆☆</span>', '<span class="rare1">★★★☆☆☆☆☆☆</span><span class="rare2">☆☆☆</span>', '<span class="rare1">★★★★☆☆☆☆☆</span><span class="rare2">☆☆☆</span>', '<span class="rare1">★★★★★☆☆☆☆</span><span class="rare2">☆☆☆</span>', '<span class="rare1">★★★★★★☆☆☆</span><span class="rare2">☆☆☆</span>', '<span class="rare1">★★★★★★★☆☆</span><span class="rare2">☆☆☆</span>', '<span class="rare1">★★★★★★★★☆</span><span class="rare2">☆☆☆</span>', '<span class="rare1">★★★★★★★★★</span><span class="rare2">☆☆☆</span>', '<span class="rare1">★★★★★★★★★</span><span class="rare2">★☆☆</span>', '<span class="rare1">★★★★★★★★★</span><span class="rare2">★★☆</span>', '<span class="rare1">★★★★★★★★★</span><span class="rare2">★★★</span>'];
    this.itemdata = new ItemData();
    this.chardata = new CharData();
    this.currentClass = "-";
    this.EFR = 0;
    this.EIC = 0;
    this.ETH = 0;
    this.EDK = 0;
    this.ELT = 0;
    this.minATP = 0;
    this.minDFP = 0;
    this.minMST = 0;
    this.minATA = 0;
    this.minEVP = 0;
    this.minLCK = 0;
    this.maxATP = 0;
    this.maxDFP = 0;
    this.maxMST = 0;
    this.maxATA = 0;
    this.maxEVP = 0;
    this.maxLCK = 0;
    this.MaxHPMat = 0;
    this.HPMat = 0;
    this.MaxTPMat = 0;
    this.TPMat = 0;
    this.PowMat = 0;
    this.DefMat = 0;
    this.MindMat = 0;
    this.EvaMat = 0;
    this.LckMat = 0;
    this.TotalMat = 0;
    this.MaxMat = 0;
    this.MagLV = 0;
    this.MagDef = 0;
    this.MagPow = 0;
    this.MagDex = 0;
    this.MagMind = 0;
    this.baseHP = 0;
    this.HPbyMat = 0;
    this.HPbyUnit = 0;
    this.curHP = 0;
    this.baseTP = 0;
    this.TPbyMat = 0;
    this.TPbyUnit = 0;
    this.curTP = 0;
    this.baseATP = 0;
    this.ATPbyMat = 0;
    this.ATPbyMag = 0;
    this.ATPbyUnit = 0;
    this.curATP = 0;
    this.diffATP = 0;
    this.baseDFP = 0;
    this.DFPbyMat = 0;
    this.DFPbyMag = 0;
    this.DFPbyUnit = 0;
    this.curDFP = 0;
    this.diffDFP = 0;
    this.baseMST = 0;
    this.MSTbyMat = 0;
    this.MSTbyMag = 0;
    this.MSTbyEquip = 0;
    this.MSTbyUnit = 0;
    this.curMST = 0;
    this.diffMST = 0;
    this.baseATA = 0;
    this.ATAbyMag = 0;
    this.ATAbyUnit = 0;
    this.curATA = 0;
    this.diffATA = 0;
    this.baseEVP = 0;
    this.EVPbyMat = 0;
    this.EVPbyUnit = 0;
    this.curEVP = 0;
    this.diffEVP = 0;
    this.baseLCK = 0;
    this.LCKbyMat = 0;
    this.LCKbyEquip = 0;
    this.LCKbyUnit = 0;
    this.curLCK = 0;
    this.diffLCK = 0;
    this.armorstar = 0;
    this.shieldstar = 0;
    this.unit1star = 0;
    this.unit2star = 0;
    this.unit3star = 0;
    this.unit4star = 0;
    this.nbatp = 0;
    this.nbata = 0;
    this.attackspeed = 0;
    this.techspeed = false;
    this.techlv = 0;
    this.smartlink = false;
    this.v50x = 0;
    this.curepoison = false;
    this.cureparalysis = false;
    this.cureslow = false;
    this.cureconfuse = false;
    this.curefreeze = false;
    this.cureshock = false;
    this.trapvision = false
};
Simulator.prototype.ArmorEquipable = function(a) {
    if (this.currentClass != "-") {
        if (typeof(this.itemdata.armors[a]) != "undefined") {
            if (typeof(this.itemdata.armors[a][this.currentClass]) == "undefined") {
                this.itemdata.armors[a]["humar"] = this.itemdata.armors[a][7][0] > 0 && this.itemdata.armors[a][7][3] > 0 && this.itemdata.armors[a][7][6] > 0;
                this.itemdata.armors[a]["hunewearl"] = this.itemdata.armors[a][7][0] > 0 && this.itemdata.armors[a][7][5] > 0 && this.itemdata.armors[a][7][7] > 0;
                this.itemdata.armors[a]["hucast"] = this.itemdata.armors[a][7][0] > 0 && this.itemdata.armors[a][7][4] > 0 && this.itemdata.armors[a][7][6] > 0;
                this.itemdata.armors[a]["hucaseal"] = this.itemdata.armors[a][7][0] > 0 && this.itemdata.armors[a][7][4] > 0 && this.itemdata.armors[a][7][7] > 0;
                this.itemdata.armors[a]["ramar"] = this.itemdata.armors[a][7][1] > 0 && this.itemdata.armors[a][7][3] > 0 && this.itemdata.armors[a][7][6] > 0;
                this.itemdata.armors[a]["ramarl"] = this.itemdata.armors[a][7][1] > 0 && this.itemdata.armors[a][7][3] > 0 && this.itemdata.armors[a][7][7] > 0;
                this.itemdata.armors[a]["racast"] = this.itemdata.armors[a][7][1] > 0 && this.itemdata.armors[a][7][4] > 0 && this.itemdata.armors[a][7][6] > 0;
                this.itemdata.armors[a]["racaseal"] = this.itemdata.armors[a][7][1] > 0 && this.itemdata.armors[a][7][4] > 0 && this.itemdata.armors[a][7][7] > 0;
                this.itemdata.armors[a]["fomar"] = this.itemdata.armors[a][7][2] > 0 && this.itemdata.armors[a][7][3] > 0 && this.itemdata.armors[a][7][6] > 0;
                this.itemdata.armors[a]["fomarl"] = this.itemdata.armors[a][7][2] > 0 && this.itemdata.armors[a][7][3] > 0 && this.itemdata.armors[a][7][7] > 0;
                this.itemdata.armors[a]["fonewm"] = this.itemdata.armors[a][7][2] > 0 && this.itemdata.armors[a][7][5] > 0 && this.itemdata.armors[a][7][6] > 0;
                this.itemdata.armors[a]["fonewearl"] = this.itemdata.armors[a][7][2] > 0 && this.itemdata.armors[a][7][5] > 0 && this.itemdata.armors[a][7][7] > 0
            }
            return this.itemdata.armors[a][this.currentClass]
        }
    }
    return false
};
Simulator.prototype.ShieldEquipable = function(a) {
    if (this.currentClass != "-") {
        if (typeof(this.itemdata.shields[a]) != "undefined") {
            if (typeof(this.itemdata.shields[a][this.currentClass]) == "undefined") {
                this.itemdata.shields[a]["humar"] = this.itemdata.shields[a][7][0] > 0 && this.itemdata.shields[a][7][3] > 0 && this.itemdata.shields[a][7][6] > 0;
                this.itemdata.shields[a]["hunewearl"] = this.itemdata.shields[a][7][0] > 0 && this.itemdata.shields[a][7][5] > 0 && this.itemdata.shields[a][7][7] > 0;
                this.itemdata.shields[a]["hucast"] = this.itemdata.shields[a][7][0] > 0 && this.itemdata.shields[a][7][4] > 0 && this.itemdata.shields[a][7][6] > 0;
                this.itemdata.shields[a]["hucaseal"] = this.itemdata.shields[a][7][0] > 0 && this.itemdata.shields[a][7][4] > 0 && this.itemdata.shields[a][7][7] > 0;
                this.itemdata.shields[a]["ramar"] = this.itemdata.shields[a][7][1] > 0 && this.itemdata.shields[a][7][3] > 0 && this.itemdata.shields[a][7][6] > 0;
                this.itemdata.shields[a]["ramarl"] = this.itemdata.shields[a][7][1] > 0 && this.itemdata.shields[a][7][3] > 0 && this.itemdata.shields[a][7][7] > 0;
                this.itemdata.shields[a]["racast"] = this.itemdata.shields[a][7][1] > 0 && this.itemdata.shields[a][7][4] > 0 && this.itemdata.shields[a][7][6] > 0;
                this.itemdata.shields[a]["racaseal"] = this.itemdata.shields[a][7][1] > 0 && this.itemdata.shields[a][7][4] > 0 && this.itemdata.shields[a][7][7] > 0;
                this.itemdata.shields[a]["fomar"] = this.itemdata.shields[a][7][2] > 0 && this.itemdata.shields[a][7][3] > 0 && this.itemdata.shields[a][7][6] > 0;
                this.itemdata.shields[a]["fomarl"] = this.itemdata.shields[a][7][2] > 0 && this.itemdata.shields[a][7][3] > 0 && this.itemdata.shields[a][7][7] > 0;
                this.itemdata.shields[a]["fonewm"] = this.itemdata.shields[a][7][2] > 0 && this.itemdata.shields[a][7][5] > 0 && this.itemdata.shields[a][7][6] > 0;
                this.itemdata.shields[a]["fonewearl"] = this.itemdata.shields[a][7][2] > 0 && this.itemdata.shields[a][7][5] > 0 && this.itemdata.shields[a][7][7] > 0
            }
            return this.itemdata.shields[a][this.currentClass]
        }
    }
    return false
};
Simulator.prototype.UnitEquipable = function(a) {
    if (this.currentClass != "-") {
        if (typeof(this.itemdata.units[a]) != "undefined") {
            if (typeof(this.itemdata.units[a][this.currentClass]) == "undefined") {
                this.itemdata.units[a]["humar"] = this.itemdata.units[a][15][0] > 0 && this.itemdata.units[a][15][3] > 0 && this.itemdata.units[a][15][6] > 0;
                this.itemdata.units[a]["hunewearl"] = this.itemdata.units[a][15][0] > 0 && this.itemdata.units[a][15][5] > 0 && this.itemdata.units[a][15][7] > 0;
                this.itemdata.units[a]["hucast"] = this.itemdata.units[a][15][0] > 0 && this.itemdata.units[a][15][4] > 0 && this.itemdata.units[a][15][6] > 0;
                this.itemdata.units[a]["hucaseal"] = this.itemdata.units[a][15][0] > 0 && this.itemdata.units[a][15][4] > 0 && this.itemdata.units[a][15][7] > 0;
                this.itemdata.units[a]["ramar"] = this.itemdata.units[a][15][1] > 0 && this.itemdata.units[a][15][3] > 0 && this.itemdata.units[a][15][6] > 0;
                this.itemdata.units[a]["ramarl"] = this.itemdata.units[a][15][1] > 0 && this.itemdata.units[a][15][3] > 0 && this.itemdata.units[a][15][7] > 0;
                this.itemdata.units[a]["racast"] = this.itemdata.units[a][15][1] > 0 && this.itemdata.units[a][15][4] > 0 && this.itemdata.units[a][15][6] > 0;
                this.itemdata.units[a]["racaseal"] = this.itemdata.units[a][15][1] > 0 && this.itemdata.units[a][15][4] > 0 && this.itemdata.units[a][15][7] > 0;
                this.itemdata.units[a]["fomar"] = this.itemdata.units[a][15][2] > 0 && this.itemdata.units[a][15][3] > 0 && this.itemdata.units[a][15][6] > 0;
                this.itemdata.units[a]["fomarl"] = this.itemdata.units[a][15][2] > 0 && this.itemdata.units[a][15][3] > 0 && this.itemdata.units[a][15][7] > 0;
                this.itemdata.units[a]["fonewm"] = this.itemdata.units[a][15][2] > 0 && this.itemdata.units[a][15][5] > 0 && this.itemdata.units[a][15][6] > 0;
                this.itemdata.units[a]["fonewearl"] = this.itemdata.units[a][15][2] > 0 && this.itemdata.units[a][15][5] > 0 && this.itemdata.units[a][15][7] > 0
            }
            return this.itemdata.units[a][this.currentClass]
        }
    }
    return false
};
Simulator.prototype.Calc = function() {
    this.baseATP = 0;
    this.baseDFP = 0;
    this.baseMST = 0;
    this.baseATA = 0;
    this.baseEVP = 0;
    this.baseLCK = 0;
    this.baseHP = 0;
    this.armorstar = 0;
    this.shieldstar = 0;
    this.unit1star = 0;
    this.unit2star = 0;
    this.unit3star = 0;
    this.unit4star = 0;
    this.nbatp = 0;
    this.nbata = 0;
    this.attackspeed = 0;
    this.techspeed = false;
    this.techlv = 0;
    this.smartlink = false;
    this.v50x = 0;
    this.curepoison = false;
    this.cureparalysis = false;
    this.cureslow = false;
    this.cureconfuse = false;
    this.curefreeze = false;
    this.cureshock = false;
    this.trapvision = false;
    if (this.currentClass != "-") {
        var a = $("#lv option:selected").text();
        if (a != "-") {
            a = Number(a);
            this.baseATP = this.chardata[this.currentClass].lv[a][0];
            this.baseDFP = this.chardata[this.currentClass].lv[a][1];
            this.baseMST = this.chardata[this.currentClass].lv[a][2];
            this.baseATA = this.chardata[this.currentClass].lv[a][3];
            this.baseEVP = this.chardata[this.currentClass].lv[a][4];
            this.baseLCK = this.chardata[this.currentClass].lv[a][5];
            this.baseHP = this.chardata[this.currentClass].lv[a][6]
        }
    }
    this.EFR = 0;
    this.EIC = 0;
    this.ETH = 0;
    this.EDK = 0;
    this.ELT = 0;
    this.MagDef = Number($("#magDef").val());
    this.MagPow = Number($("#magPow").val());
    this.MagDex = Number($("#magDex").val());
    this.MagMind = Number($("#magMind").val());
    this.MagLV = this.MagDef + this.MagPow + this.MagDex + this.MagMind;
    this.DFPbyMag = this.MagDef;
    this.ATPbyMag = this.MagPow * 2;
    this.ATAbyMag = this.MagDex * 5;
    this.MSTbyMag = this.MagMind * 2;
    this.HPMat = Number($("#matHP").val());
    this.TPMat = Number($("#matTP").val());
    this.PowMat = Number($("#matPow").val());
    this.DefMat = Number($("#matDef").val());
    this.MindMat = Number($("#matMind").val());
    this.EvaMat = Number($("#matEva").val());
    this.LckMat = Number($("#matLck").val());
    this.TotalMat = this.PowMat + this.DefMat + this.MindMat + this.EvaMat + this.LckMat;
    this.HPbyMat = this.HPMat * 2;
    this.TPbyMat = this.TPMat * 2;
    this.ATPbyMat = this.PowMat * 2;
    this.DFPbyMat = this.DefMat * 2;
    this.MSTbyMat = this.MindMat * 2;
    this.EVPbyMat = this.EvaMat * 2;
    this.LCKbyMat = this.LckMat * 2;
    var b = $("#armor option:selected").val();
    var c = this.ArmorEquipable(b);
    var d = $("#shield option:selected").val();
    var e = this.ShieldEquipable(d);
    if (typeof(this.itemdata.armors[b]) != "undefined") {
        if (c) {
            this.EFR += this.itemdata.armors[b][1];
            this.EIC += this.itemdata.armors[b][2];
            this.ETH += this.itemdata.armors[b][3];
            this.EDK += this.itemdata.armors[b][4];
            this.ELT += this.itemdata.armors[b][5]
        }
        this.armorstar = this.itemdata.armors[b][6]
    }
    if (typeof(this.itemdata.shields[d]) != "undefined") {
        if (e) {
            this.EFR += this.itemdata.shields[d][1];
            this.EIC += this.itemdata.shields[d][2];
            this.ETH += this.itemdata.shields[d][3];
            this.EDK += this.itemdata.shields[d][4];
            this.ELT += this.itemdata.shields[d][5]
        }
        this.shieldstar = this.itemdata.shields[d][6]
    }
    if (c && e) {
        if (b == "56" && d == "9b") {
            this.EFR += 20;
            this.EIC += 20;
            this.ETH += 20;
            this.EDK += 20;
            this.ELT += 20
        } else if (b == "45" && d == "2a") {
            this.EFR += 2;
            this.EIC += 2;
            this.ETH += 2;
            this.EDK += 5;
            this.ELT += 5
        }
    }
    this.MSTbyEquip = 0;
    this.LCKbyEquip = 0;
    if (c) {
        if (b == "1e") {
            this.nbatp += 35
        } else if (b == "1f") {
            this.nbatp += 10
        } else if (b == "23") {
            this.trapvision = true
        } else if (b == "24") {
            this.nbata -= 10
        } else if (b == "33") {
            this.cureparalysis = true
        } else if (b == "38") {
            this.SetAttackSpeed(10)
        } else if (b == "39") {
            this.SetAttackSpeed(20)
        } else if (b == "3a") {
            this.SetAttackSpeed(30)
        } else if (b == "3b") {
            this.SetAttackSpeed(40)
        } else if (b == "54") {
            this.trapvision = true
        } else if (b == "56") {
            this.SetAttackSpeed(20)
        }
    }
    if (e) {
        if (d == "16") {
            this.curepoison = true
        } else if (d == "18") {
            this.nbata += 15
        } else if (d == "1b") {
            this.MSTbyEquip += 20
        } else if (d == "1c") {
            this.nbata += 20
        } else if (d == "1d") {
            this.nbatp += 15
        } else if (d == "20") {
            this.nbatp += 35
        } else if (d == "27") {
            this.MSTbyEquip += 20;
            this.LCKbyEquip += 20;
            this.nbatp += 20;
            this.nbata += 20
        } else if (d == "2b") {
            this.nbatp += 35
        } else if (d == "31") {
            this.trapvision = true
        } else if (d == "8a") {
            this.nbatp += 35
        }
    }
    this.HPbyUnit = 0;
    this.TPbyUnit = 0;
    this.ATPbyUnit = 0;
    this.DFPbyUnit = 0;
    this.MSTbyUnit = 0;
    this.ATAbyUnit = 0;
    this.EVPbyUnit = 0;
    this.LCKbyUnit = 0;
    for (var i = 1; i <= 4; i++) {
        var f = $("#unit" + i + " option:selected").val();
        var g = this.UnitEquipable(f);
        if (typeof(this.itemdata.units[f]) != "undefined") {
            if (g) {
                this.HPbyUnit += this.itemdata.units[f][1];
                this.TPbyUnit += this.itemdata.units[f][2];
                this.ATPbyUnit += this.itemdata.units[f][3];
                this.DFPbyUnit += this.itemdata.units[f][4];
                this.MSTbyUnit += this.itemdata.units[f][5];
                this.ATAbyUnit += this.itemdata.units[f][6];
                this.EVPbyUnit += this.itemdata.units[f][7];
                this.LCKbyUnit += this.itemdata.units[f][8];
                this.EFR += this.itemdata.units[f][9];
                this.EIC += this.itemdata.units[f][10];
                this.ETH += this.itemdata.units[f][11];
                this.EDK += this.itemdata.units[f][12];
                this.ELT += this.itemdata.units[f][13]
            }
            switch (i) {
                case 1:
                    this.unit1star = this.itemdata.units[f][14];
                    break;
                case 2:
                    this.unit2star = this.itemdata.units[f][14];
                    break;
                case 3:
                    this.unit3star = this.itemdata.units[f][14];
                    break;
                case 4:
                    this.unit4star = this.itemdata.units[f][14];
                    break;
                default:
                    break
            }
        }
        if (g) {
            if (f == "3c") {
                this.techlv += 1
            } else if (f == "3d") {
                this.techlv += 2
            } else if (f == "3e") {
                this.techlv += 3
            } else if (f == "3f") {
                this.SetAttackSpeed(5)
            } else if (f == "40") {
                this.SetAttackSpeed(10)
            } else if (f == "41") {
                this.SetAttackSpeed(20)
            } else if (f == "42") {
                this.curepoison = true
            } else if (f == "43") {
                this.cureparalysis = true
            } else if (f == "44") {
                this.cureslow = true
            } else if (f == "45") {
                this.cureconfuse = true
            } else if (f == "46") {
                this.curefreeze = true
            } else if (f == "47") {
                this.cureshock = true
            } else if (f == "49") {
                this.SetAttackSpeed(40)
            } else if (f == "4a") {
                if (this.v50x == 0) {
                    this.v50x = 1
                }
            } else if (f == "4b") {
                if (this.v50x != 2) {
                    this.v50x = 2
                }
            } else if (f == "4c") {
                this.techspeed = true
            } else if (f == "51") {
                this.smartlink = true
            } else if (f == "52") {
                this.LCKbyUnit += (this.baseLCK + this.LCKbyMat)
            } else if (f == "53") {
                this.SetAttackSpeed(40)
            } else if (f == "60") {
                this.techlv += 4
            } else if (f == "66") {
                this.trapvision = true
            } else if (f == "6a") {
                this.SetAttackSpeed(50)
            }
        }
    }
    if (this.EFR < 0) {
        this.EFR = 0
    }
    if (this.EIC < 0) {
        this.EIC = 0
    }
    if (this.ETH < 0) {
        this.ETH = 0
    }
    if (this.EDK < 0) {
        this.EDK = 0
    }
    if (this.ELT < 0) {
        this.ELT = 0
    }
    this.curATP = this.baseATP + this.ATPbyMat + this.ATPbyMag + this.ATPbyUnit;
    this.curDFP = this.baseDFP + this.DFPbyMat + this.DFPbyMag + this.DFPbyUnit;
    this.curMST = this.baseMST + this.MSTbyMat + this.MSTbyMag + this.MSTbyEquip + this.MSTbyUnit;
    this.curATA = (this.baseATA + this.ATAbyMag + this.ATAbyUnit);
    this.curEVP = this.baseEVP + this.EVPbyMat + this.EVPbyUnit;
    this.curLCK = this.baseLCK + this.LCKbyMat + this.LCKbyEquip + this.LCKbyUnit;
    if (this.curATP < this.minATP) {
        this.curATP = this.minATP
    }
    if (this.curDFP < this.minDFP) {
        this.curDFP = this.minDFP
    }
    if (this.curMST < this.minMST) {
        this.curMST = this.minMST
    }
    if (this.curATA < this.minATA) {
        this.curATA = this.minATA
    }
    if (this.curEVP < this.minEVP) {
        this.curEVP = this.minEVP
    }
    if (this.curLCK < this.minLCK) {
        this.curLCK = this.minLCK
    }
    this.curHP = this.baseHP + this.HPbyMat + this.HPbyUnit;
    var h = this.curMST;
    if (h > this.maxMST) {
        h = this.maxMST
    }
    switch (this.currentClass) {
        case "hucast":
        case "hucaseal":
        case "racast":
        case "racaseal":
            this.baseTP = 0;
            break;
        case "fomar":
        case "fomarl":
        case "fonewm":
        case "fonewearl":
            this.baseTP = Math.floor((h + a - 1) * 1.5);
            break;
        case "humar":
        case "hunewearl":
        case "ramar":
        case "ramarl":
            this.baseTP = h + a - 1;
            break;
        default:
            this.baseTP = 0;
            break
    }
    this.curTP = this.baseTP + this.TPbyMat + this.TPbyUnit;
    if (this.currentClass == "hucast" || this.currentClass == "hucaseal" || this.currentClass == "racast" || this.currentClass == "racaseal") {
        this.curTP = 0
    }
    this.diffATP = this.curATP - this.maxATP;
    this.diffDFP = this.curDFP - this.maxDFP;
    this.diffMST = this.curMST - this.maxMST;
    this.diffATA = this.curATA - this.maxATA;
    this.diffEVP = this.curEVP - this.maxEVP;
    this.diffLCK = this.curLCK - this.maxLCK
};
Simulator.prototype.GetATAStr = function(a) {
    if (a % 5 == 0) {
        return a / 10
    }
    if (a > 0) {
        return (Math.floor(a / 10) + (a % 10 < 5 ? 0 : 0.5)) + "<small>(" + a / 10 + ")</small>"
    } else {
        return (Math.floor(a / 10) + (a % 10 < -5 ? 0 : 0.5)) + "<small>(" + a / 10 + ")</small>"
    }
    return "(" + a / 10 + ")"
};
Simulator.prototype.SetAttackSpeed = function(a) {
    if (this.attackspeed < a) {
        this.attackspeed = a
    }
};
Simulator.prototype.ShowResult = function() {
    $("#armorstar").html(this.stars[this.armorstar]);
    $("#shieldstar").html(this.stars[this.shieldstar]);
    $("#unit1star").html(this.stars[this.unit1star]);
    $("#unit2star").html(this.stars[this.unit2star]);
    $("#unit3star").html(this.stars[this.unit3star]);
    $("#unit4star").html(this.stars[this.unit4star]);
    $("#magLV").val(this.MagLV);
    if (this.MagLV > 200) {
        $("#magLV").addClass("exceeded1")
    } else {
        $("#magLV").removeClass("exceeded1")
    }
    $("#matHPcur").val(this.HPMat);
    $("#matHPMax").val(this.MaxHPMat);
    if (this.HPMat > this.MaxHPMat) {
        $("#matHPcur").addClass("exceeded1")
    } else {
        $("#matHPcur").removeClass("exceeded1")
    }
    $("#matTPcur").val(this.TPMat);
    $("#matTPMax").val(this.MaxTPMat);
    if (this.TPMat > this.MaxTPMat) {
        $("#matTPcur").addClass("exceeded1")
    } else {
        $("#matTPcur").removeClass("exceeded1")
    }
    $("#matTotal").val(this.TotalMat);
    $("#matMax").val(this.MaxMat);
    if (this.TotalMat > this.MaxMat) {
        $("#matTotal").addClass("exceeded1")
    } else {
        $("#matTotal").removeClass("exceeded1")
    }
    $("#baseHP").text(this.baseHP);
    $("#HPbyMat").text(this.HPbyMat);
    $("#HPbyUnit").text(this.HPbyUnit);
    $("#curHP").text(this.curHP);
    $("#baseTP").text(this.baseTP);
    $("#TPbyMat").text(this.TPbyMat);
    $("#TPbyUnit").text(this.TPbyUnit);
    $("#curTP").text(this.curTP);
    $("#baseATP").text(this.baseATP);
    $("#ATPbyMat").text(this.ATPbyMat);
    $("#ATPbyMag").text(this.ATPbyMag);
    $("#ATPbyUnit").text(this.ATPbyUnit);
    $("#curATP").text(this.curATP > this.maxATP && (this.ATPbyMag != 0 || this.ATPbyMat != 0 || this.ATPbyUnit != 0) ? this.maxATP : this.curATP);
    if (this.currentClass != "-" && this.curATP >= this.maxATP) {
        $("#curATP").addClass("maxed")
    } else {
        $("#curATP").removeClass("maxed")
    }
    $("#maxATP").text(this.maxATP);
    $("#diffATP").text(this.diffATP);
    if (this.diffATP > 0) {
        $("#diffATP").addClass("exceeded2")
    } else {
        $("#diffATP").removeClass("exceeded2")
    }
    $("#baseDFP").text(this.baseDFP);
    $("#DFPbyMat").text(this.DFPbyMat);
    $("#DFPbyMag").text(this.DFPbyMag);
    $("#DFPbyUnit").text(this.DFPbyUnit);
    $("#curDFP").text(this.curDFP > this.maxDFP && (this.DFPbyMag != 0 || this.DFPbyMat != 0 || this.DFPbyUnit != 0) ? this.maxDFP : this.curDFP);
    if (this.currentClass != "-" && this.curDFP >= this.maxDFP) {
        $("#curDFP").addClass("maxed")
    } else {
        $("#curDFP").removeClass("maxed")
    }
    $("#maxDFP").text(this.maxDFP);
    $("#diffDFP").text(this.diffDFP);
    if (this.diffDFP > 0) {
        $("#diffDFP").addClass("exceeded2")
    } else {
        $("#diffDFP").removeClass("exceeded2")
    }
    $("#baseMST").text(this.baseMST);
    $("#MSTbyMat").text(this.MSTbyMat);
    $("#MSTbyMag").text(this.MSTbyMag);
    $("#MSTbyEquip").text(this.MSTbyEquip);
    $("#MSTbyUnit").text(this.MSTbyUnit);
    $("#curMST").text(this.curMST > this.maxMST && (this.MSTbyMag != 0 || this.MSTbyMat != 0 || this.MSTbyUnit != 0 || this.MSTbyEquip != 0) ? this.maxMST : this.curMST);
    if (this.currentClass != "-" && this.curMST >= this.maxMST) {
        $("#curMST").addClass("maxed")
    } else {
        $("#curMST").removeClass("maxed")
    }
    $("#maxMST").text(this.maxMST);
    $("#diffMST").text(this.diffMST);
    if (this.diffMST > 0) {
        $("#diffMST").addClass("exceeded2")
    } else {
        $("#diffMST").removeClass("exceeded2")
    }
    $("#baseATA").html(this.GetATAStr(this.baseATA));
    $("#ATAbyMag").text(this.ATAbyMag / 10);
    $("#ATAbyUnit").text(this.ATAbyUnit / 10);
    $("#curATA").html(this.curATA > this.maxATA ? this.maxATA / 10 : this.GetATAStr(this.curATA));
    if (this.currentClass != "-" && this.curATA >= this.maxATA) {
        $("#curATA").addClass("maxed")
    } else {
        $("#curATA").removeClass("maxed")
    }
    $("#maxATA").text(this.maxATA / 10);
    $("#diffATA").html(this.GetATAStr(this.diffATA));
    if (this.diffATA > 0) {
        $("#diffATA").addClass("exceeded2")
    } else {
        $("#diffATA").removeClass("exceeded2")
    }
    $("#baseEVP").text(this.baseEVP);
    $("#EVPbyMat").text(this.EVPbyMat);
    $("#EVPbyUnit").text(this.EVPbyUnit);
    $("#curEVP").text(this.curEVP > this.maxEVP && (this.EVPbyMat != 0 || this.EVPbyUnit != 0) ? this.maxEVP : this.curEVP);
    if (this.currentClass != "-" && this.curEVP >= this.maxEVP) {
        $("#curEVP").addClass("maxed")
    } else {
        $("#curEVP").removeClass("maxed")
    }
    $("#maxEVP").text(this.maxEVP);
    $("#diffEVP").text(this.diffEVP);
    if (this.diffEVP > 0) {
        $("#diffEVP").addClass("exceeded2")
    } else {
        $("#diffEVP").removeClass("exceeded2")
    }
    $("#baseLCK").text(this.baseLCK);
    $("#LCKbyMat").text(this.LCKbyMat);
    $("#LCKbyEquip").text(this.LCKbyEquip);
    $("#LCKbyUnit").text(this.LCKbyUnit);
    $("#curLCK").text(this.curLCK > this.maxLCK && (this.LCKbyMat != 0 || this.LCKbyEquip != 0 || this.LCKbyUnit != 0) ? this.maxLCK : this.curLCK);
    if (this.currentClass != "-" && this.curLCK >= this.maxLCK) {
        $("#curLCK").addClass("maxed")
    } else {
        $("#curLCK").removeClass("maxed")
    }
    $("#maxLCK").text(this.maxLCK);
    $("#diffLCK").text(this.diffLCK);
    if (this.diffLCK > 0) {
        $("#diffLCK").addClass("exceeded2")
    } else {
        $("#diffLCK").removeClass("exceeded2")
    }
    $("#EFR").text(this.EFR);
    $("#EIC").text(this.EIC);
    $("#ETH").text(this.ETH);
    $("#EDK").text(this.EDK);
    $("#ELT").text(this.ELT);
    $("#nbatp").text(this.nbatp);
    $("#nbata").text(this.nbata);
    $("#attackspeed").text(this.attackspeed);
    $("#techspeed").text(this.techspeed ? "V801" : "-");
    $("#techlv").text(this.techlv);
    $("#smartlink").text(this.smartlink ? "有" : "-");
    $("#v50x").text((this.v50x == 2) ? "V502" : ((this.v50x == 1) ? "V501" : "-"));
    $("#curepoison").text(this.curepoison ? "有" : "-");
    $("#cureparalysis").text(this.cureparalysis ? "有" : "-");
    $("#cureslow").text(this.cureslow ? "有" : "-");
    $("#cureconfuse").text(this.cureconfuse ? "有" : "-");
    $("#curefreeze").text(this.curefreeze ? "有" : "-");
    $("#cureshock").text(this.cureshock ? "有" : "-");
    $("#trapvision").text(this.trapvision ? "有" : "-");
    var b = [];
    var c = [];
    if (this.currentClass != "-") {
        c.push('c=' + this.currentClass);
        c.push('lv=' + $("#lv option:selected").text())
    }
    if (this.MagDef > 0) {
        c.push('mdef=' + this.MagDef)
    }
    if (this.MagPow > 0) {
        c.push('mpow=' + this.MagPow)
    }
    if (this.MagDex > 0) {
        c.push('mdex=' + this.MagDex)
    }
    if (this.MagMind > 0) {
        c.push('mmind=' + this.MagMind)
    }
    if (this.HPMat > 0) {
        c.push('hp=' + this.HPMat)
    }
    if (this.TPMat > 0) {
        c.push('tp=' + this.TPMat)
    }
    if (this.PowMat > 0) {
        c.push('pow=' + this.PowMat)
    }
    if (this.DefMat > 0) {
        c.push('def=' + this.DefMat)
    }
    if (this.MindMat > 0) {
        c.push('mind=' + this.MindMat)
    }
    if (this.EvaMat > 0) {
        c.push('eva=' + this.EvaMat)
    }
    if (this.LckMat > 0) {
        c.push('lck=' + this.LckMat)
    }
    var d = $("#armor option:selected").val();
    if (d != "-") {
        c.push('armor=' + d)
    }
    var f = $("#shield option:selected").val();
    if (f != "-") {
        c.push('shield=' + f)
    }
    for (var i = 1; i <= 4; i++) {
        var g = $("#unit" + i + " option:selected").val();
        if (g != "-") {
            c.push('unit' + i + '=' + g)
        }
    }
    if (c.length > 0) {
        var h = this.loc + "?" + c.join("&");
        b.push('URL: <a href="' + h + '">' + h + '</a>');
        b.push('')
    }
    b.push($("#class option:selected").text() + " @ " + $("#lv option:selected").text() + " LV");
    b.push("--------------------------------");
    var j = $("#armor option:selected").text();
    var k = this.ArmorEquipable($("#armor option:selected").val());
    if (j != "-") {
        b.push("Armor:" + (k ? "" : "[×] <s>") + j + (k ? "" : "</s>"))
    }
    var l = $("#shield option:selected").text();
    var m = this.ShieldEquipable($("#shield option:selected").val());
    if (l != "-") {
        b.push("Shield:" + (m ? "" : "[×] <s>") + l + (m ? "" : "</s>"))
    }
    var n = [];
    $(".unit option:selected").each(function(e) {
        var t = $(this).text();
        var a = sim.UnitEquipable($(this).val());
        if (t != "-") {
            n.push((a ? "" : "[×] <s>") + t + (a ? "" : "</s>"))
        }
    });
    if (n.length > 0) {
        b.push("Units:" + n.join(", "))
    }
    b.push("Mag:" + this.MagDef + "/" + this.MagPow + "/" + this.MagDex + "/" + this.MagMind + " @ " + this.MagLV + " LV");
    b.push("Mats:" + (this.TotalMat <= this.MaxMat ? " " + (this.MaxMat - this.TotalMat) + " left" : (this.TotalMat > this.MaxMat ? " exceed: " + this.MaxMat + " by: " + (this.TotalMat - this.MaxMat) : "")));
    if (this.PowMat > 0) {
        b.push("- " + this.PowMat + " Power")
    }
    if (this.DefMat > 0) {
        b.push("- " + this.DefMat + " Def")
    }
    if (this.MindMat > 0) {
        b.push("- " + this.MindMat + " Mind")
    }
    if (this.EvaMat > 0) {
        b.push("- " + this.EvaMat + " Evade")
    }
    if (this.LckMat > 0) {
        b.push("- " + this.LckMat + " Luck")
    }
    if (this.currentClass != "-") {
        b.push("--------------------------------");
        if (this.diffATP < 0 || this.diffDFP < 0 || this.diffMST < 0 || this.diffATA < 0 || this.diffEVP < 0 || this.diffLCK < 0) {
            b.push("All stats maxed out except:");
            if (this.diffATP < 0) {
                b.push("ATP:" + this.diffATP)
            }
            if (this.diffDFP < 0) {
                b.push("DFP:" + this.diffDFP)
            }
            if (this.diffMST < 0) {
                b.push("MST:" + this.diffMST)
            }
            if (this.diffATA < 0) {
                b.push("ATA:" + this.GetATAStr(this.diffATA))
            }
            if (this.diffEVP < 0) {
                b.push("EVP:" + this.diffEVP)
            }
            if (this.diffLCK < 0) {
                b.push("LCK:" + this.diffLCK)
            }
        } else if (this.diffATP >= 0 && this.diffDFP >= 0 && this.diffMST >= 0 && this.diffATA >= 0 && this.diffEVP >= 0 && this.diffLCK >= 0) {
            b.push("All stats maxed")
        }
    }
    $("#output").html(b.join("<br />"))
};
Simulator.prototype.SetClass = function(s) {
    this.currentClass = s;
    if (s != "-") {
        this.minATP = this.chardata[s].min[0];
        this.minDFP = this.chardata[s].min[1];
        this.minMST = this.chardata[s].min[2];
        this.minATA = this.chardata[s].min[3];
        this.minEVP = this.chardata[s].min[4];
        this.minLCK = this.chardata[s].min[5];
        this.maxATP = this.chardata[s].max[0];
        this.maxDFP = this.chardata[s].max[1];
        this.maxMST = this.chardata[s].max[2];
        this.maxATA = this.chardata[s].max[3];
        this.maxEVP = this.chardata[s].max[4];
        this.maxLCK = this.chardata[s].max[5];
        this.MaxMat = this.chardata[s].mat[0];
        this.MaxHPMat = this.chardata[s].mat[1];
        this.MaxTPMat = this.chardata[s].mat[2];
        var a = $("#lv").val();
        $("#lv option").remove();
        var b = [];
        for (var c in this.chardata[s].lv) {
            b.push('<option value="' + c + '">' + c + '</option>')
        }
        $(b.join('\n')).appendTo($("#lv"));
        if (a == "-") {
            $("#lv").val(200)
        } else {
            $("#lv").val(a)
        }
    } else {
        $("#lv option").remove();
        $('"-",').appendTo($("#lv"));
        this.minATP = 0;
        this.minDFP = 0;
        this.minMST = 0;
        this.minATA = 0;
        this.minEVP = 0;
        this.minLCK = 0;
        this.maxATP = 0;
        this.maxDFP = 0;
        this.maxMST = 0;
        this.maxATA = 0;
        this.maxEVP = 0;
        this.maxLCK = 0;
        this.MaxHPMat = 0;
        this.MaxTPMat = 0;
        this.MaxMat = 0
    }
};
var sim = new Simulator();

function calc() {
    sim.Calc();
    sim.ShowResult()
}

function OnClassChange() {
    var s = $("#class option:selected").val();
    sim.SetClass(s);
    calc()
}

function OnMagReset() {
    $("#magDef").val(5);
    $("#magPow").val(0);
    $("#magDex").val(0);
    $("#magMind").val(0);
    calc()
}

function OnMatReset() {
    $("#matHP").val(0);
    $("#matTP").val(0);
    $("#matPow").val(0);
    $("#matDef").val(0);
    $("#matMind").val(0);
    $("#matEva").val(0);
    $("#matLck").val(0);
    calc()
}

function OnEquipReset() {
    $("#armor").val("-");
    $("#shield").val("-");
    calc()
}

function OnUnitReset() {
    $(".unit").val("-");
    calc()
}

function InitSelectOption(a, b) {
    var c = [];
    var d = [];
    for (var e in b) {
        d.push(e)
    }
    d.sort();
    for (var i = 0; i < d.length; i++) {
        c.push('<option value="' + d[i] + '">' + b[d[i]][0] + '</option>')
    }
    $(c.join('\n')).appendTo($(a))
}
function init() {
    var a = document.location.search.substring(1).split('&');
    for (var i = 0; i < a.length; i++) {
        var q = a[i].split('=');
        if (q.length == 2) {
            switch (q[0]) {
                case 'c':
                    switch (q[1].toLowerCase()) {
                        case 'humar':
                        case 'hunewearl':
                        case 'hucast':
                        case 'hucaseal':
                        case 'ramar':
                        case 'ramarl':
                        case 'racast':
                        case 'racaseal':
                        case 'fomar':
                        case 'fomarl':
                        case 'fonewm':
                        case 'fonewearl':
                            $('#class').val(q[1]);
                            sim.SetClass(q[1]);
                            break
                    }
                    break;
                case 'lv':
                    var v = parseInt(q[1]);
                    if (v >= 1 && v <= 200) {
                        $('#lv').val(v)
                    }
                    break;
                case 'mdef':
                    var v = parseInt(q[1]);
                    if (v >= 0 && v <= 999) {
                        $('#magDef').val(v)
                    }
                    break;
                case 'mpow':
                    var v = parseInt(q[1]);
                    if (v >= 0 && v <= 999) {
                        $('#magPow').val(v)
                    }
                    break;
                case 'mdex':
                    var v = parseInt(q[1]);
                    if (v >= 0 && v <= 999) {
                        $('#magDex').val(v)
                    }
                    break;
                case 'mmind':
                    var v = parseInt(q[1]);
                    if (v >= 0 && v <= 999) {
                        $('#magMind').val(v)
                    }
                    break;
                case 'hp':
                    var v = parseInt(q[1]);
                    if (v >= 0 && v <= 999) {
                        $('#matHP').val(v)
                    }
                    break;
                case 'tp':
                    var v = parseInt(q[1]);
                    if (v >= 0 && v <= 999) {
                        $('#matTP').val(v)
                    }
                    break;
                case 'pow':
                    var v = parseInt(q[1]);
                    if (v >= 0 && v <= 999) {
                        $('#matPow').val(v)
                    }
                    break;
                case 'def':
                    var v = parseInt(q[1]);
                    if (v >= 0 && v <= 999) {
                        $('#matDef').val(v)
                    }
                    break;
                case 'mind':
                    var v = parseInt(q[1]);
                    if (v >= 0 && v <= 999) {
                        $('#matMind').val(v)
                    }
                    break;
                case 'eva':
                    var v = parseInt(q[1]);
                    if (v >= 0 && v <= 999) {
                        $('#matEva').val(v)
                    }
                    break;
                case 'lck':
                    var v = parseInt(q[1]);
                    if (v >= 0 && v <= 999) {
                        $('#matLck').val(v)
                    }
                    break;
                case 'armor':
                    $('#armor').val(q[1].toLowerCase());
                    break;
                case 'shield':
                    $('#shield').val(q[1].toLowerCase());
                    break;
                case 'unit1':
                case 'unit2':
                case 'unit3':
                case 'unit4':
                    $('#' + q[0]).val(q[1].toLowerCase());
                    break;
                default:
                    break
            }
        }
    }
}

$(document).ready(function() {
    InitSelectOption("#class", sim.itemdata.clazz);
    InitSelectOption("#armor", sim.itemdata.armors);
    InitSelectOption("#shield", sim.itemdata.shields);
    InitSelectOption(".unit", sim.itemdata.units);
    $("#class").change(OnClassChange).keyup(OnClassChange);
    $("#magReset").click(OnMagReset);
    $("#matReset").click(OnMatReset);
    $("#equipReset").click(OnEquipReset);
    $("#unitReset").click(OnUnitReset);
    $("#lv, #armor, #shield, #unit1, #unit2, #unit3, #unit4").change(calc).keyup(calc);
    $("#magDef, #magPow, #magDex, #magMind, #matHP, #matTP, #matPow, #matDef, #matMind, #matEva, #matLck").keyup(calc);
    $("#class, #lv").val("-");
    init();
    calc()
});