
var defineElement = function (def) {
  var e = document.createElementNS ('data:,pc', 'element');
  e.pcDef = def;
  document.head.appendChild (e);

  if (def.fill) {
    var e = document.createElementNS ('data:,pc', 'filltype');
    e.setAttribute ('name', def.name);
    e.setAttribute ('content', def.fill);
    document.head.appendChild (e);
    delete def.fill;
  }
}; // defineElement

defineElement ({
  name: 'section',
  is: 'rbr-tab-section',
  props: {
    pcInit: function () {
      if (this.classList.contains ('active')) {
        this.rbrRender ();
      } else {
        this.addEventListener ('show', () => this.rbrRender (), {once: true});
      }
    }, // pcInit
    rbrRender: function () {
      if (this.rbrRendered) return;
      this.rbrRendered = true;

      var template = this.querySelector ('template');
      template.parentNode.replaceChild (template.content.cloneNode (true), template);
    },
  },
}); // <section is=rbr-tab-section>

defineElement ({
  name: 'rbr-event',
  props: {
    pcInit: function () {
      return this.rbrInit ();
    },
    _getJSON: function (topURL, jsonURL) {
      return fetch (topURL + jsonURL).then (res => {
        if (res.status !== 200) throw res;
        return res.json ();
      });
    }, // _getJSON
    rbrInit: function () {
      let url = new window.URL (location.href);
      let eid = url.searchParams.get ('event_id');
      
      let topURL = "https://ibuki.run/ev/"+eid+"/";
      return Promise.all ([
        this._getJSON (topURL, "info.json"),
        this._getJSON (topURL, "teams.json?with_owner_data=1"),
        this._getJSON (topURL, "results.json"),
      ]).then (([ii, tt, rr]) => {
        this.rbrInfo = ii;
        this.rbrResults = rr.items;
        this.rbrResultsTimestamp = rr.timestamp;

        let rankingTypes = this.rbrRankingTypes = [];
        ii.ranking_types.forEach (_ => {
          rankingTypes[_.id] = _;
        });

        let startGroups = this.rbrStartGroups = [];
        ii.start_groups.forEach (_ => {
          startGroups[_.id] = _;
        });

        this.rbrTeams = tt.items;
        let teams = this.rbrTeamsById = {};
        tt.items.forEach (_ => {
          teams[_.id] = _;
        });

        this.rbrMarkedPoints = ii.marked_points;
        let mps = this.rbrMarkedPointsById = {};
        ii.marked_points.forEach (_ => {
          mps[_.id] = _;
        });

        let ev = new Event ('rbreventdataupdate', {bubbles: true});
        this.querySelectorAll ('[data-event]').forEach (_ => {
          _.dispatchEvent (ev);
        });
      });
    },
  },
}); // <rbr-event>

defineElement ({
  name: 'rbr-select-markedpoint',
  props: {
    pcInit: function () {
      this.setAttribute ('data-event', 'markedpoints');
      this.addEventListener ('rbreventdataupdate', () => {
        this.rbrInit ();
      });
      return this.rbrInit ();
    },
    rbrEvent: function () {
      let p = this.parentNode;
      while (p && p.localName !== 'rbr-event') p = p.parentNode;
      return p;
    },
    rbrInit: function () {
      if (!this.rbrEvent ()) return;
      
      let mps = this.rbrEvent ().rbrMarkedPoints || [];
      this.querySelectorAll ('select').forEach (select => {
        select.textContent = '';
        mps.forEach (mp => {
          let option = document.createElement ('option');
          option.label = '[' + mp.short_label + '] ' + mp.label;
          option.value = mp.id;
          option.selected = true;
          select.appendChild (option);
        });
      });

      this.dispatchEvent (new Event ('change', {bubbles: true}));
    }, // rbrInit
  },
}); // <rbr-select-markedpoint>

defineElement ({
  name: 'rbr-select-rankingtype',
  props: {
    pcInit: function () {
      this.setAttribute ('data-event', 'rankingtypes');
      this.addEventListener ('rbreventdataupdate', () => {
        this.rbrInit ();
      });
      return this.rbrInit ();
    },
    rbrEvent: function () {
      let p = this.parentNode;
      while (p && p.localName !== 'rbr-event') p = p.parentNode;
      return p;
    },
    rbrInit: function () {
      if (!this.rbrEvent ()) return;
      
      let rts = this.rbrEvent ().rbrRankingTypes || [];
      this.querySelectorAll ('select').forEach (select => {
        select.textContent = '';
        rts.forEach (rt => {
          let option = document.createElement ('option');
          option.label = '[' + rt.short_label + '] ' + rt.label;
          option.value = rt.id;
          select.appendChild (option);
        });
      });

      this.dispatchEvent (new Event ('change', {bubbles: true}));
    }, // rbrInit
  },
}); // <rbr-select-rankingtype>

defineElement ({
  name: 'rbr-select-teams',
  props: {
    pcInit: function () {
      this.setAttribute ('data-event', 'teams');
      this.addEventListener ('rbreventdataupdate', () => {
        this.rbrInit ();
      });
      return this.rbrInit ();
    },
    rbrEvent: function () {
      let p = this.parentNode;
      while (p && p.localName !== 'rbr-event') p = p.parentNode;
      return p;
    },
    rbrInit: function () {
      let ev = this.rbrEvent ();
      if (!ev) return;

      let rts = ev.rbrRankingTypes || [];
      let sgs = ev.rbrStartGroups || [];
      let teams = ev.rbrTeamsById || {};
      let mps = ev.rbrMarkedPoints || [];
      let results = ev.rbrResults || [];

      let els = [];

      if (rts.length) {
        let details = document.createElement ('details');
        details.innerHTML = '<summary>表彰種別</summary>';
        rts.forEach (rt => {
          let li = document.createElement ('button');
          li.type = 'button';
          li.innerHTML = '<rankingtype-icon></rankingtype-icon> <bdi></bdi>';
          li.querySelector ('rankingtype-icon').textContent = rt.short_label;
          li.querySelector ('bdi').textContent = rt.label;
          li.onclick = (ev) => {
            list.querySelectorAll ('input[name=team]').forEach (input => {
              input.checked = teams[input.value].ranking_types.includes (rt.id)
            });
            this.dispatchEvent (new Event ('change', {bubbles: true}));
            ev.stopPropagation ();
          };
          details.appendChild (li);
        });
        els.push (details);
      } // rts

      if (sgs.length) {
        let details = document.createElement ('details');
        details.innerHTML = '<summary>グループ</summary>';
        sgs.forEach (sg => {
          let li = document.createElement ('button');
          li.type = 'button';
          li.innerHTML = '<bdi></bdi>';
          li.querySelector ('bdi').textContent = sg.label;
          li.onclick = (ev) => {
            list.querySelectorAll ('input[name=team]').forEach (input => {
              input.checked = teams[input.value].start_groups.includes (sg.id)
            });
            this.dispatchEvent (new Event ('change', {bubbles: true}));
            ev.stopPropagation ();
          };
          details.appendChild (li);
        });
        els.push (details);
      } // sgs

      if (mps.length) {
        let resultByTeam = {};
        let resultByTeamAny = {};
        results.forEach (_ => {
          if (_.p == 0) {
            //
          } else {
            resultByTeam[_.r] = resultByTeam[_.r] || {};
            resultByTeam[_.r][_.t] = resultByTeam[_.r][_.t] || {};
            resultByTeam[_.r][_.t][_.p] = _;
          }
        });
        
        let details = document.createElement ('details');
        details.innerHTML = '<summary>通過</summary><div onclick="event.stopPropagation()" onchange="event.stopPropagation()" oninput=event.stopPropagation()><label><input type=radio checked name=mode value=passed> 全通過者</label><label><input type=radio name=mode value=not_passed> 全未通過者</label><label><input type=radio name=mode value=top> 上位</label><input type=number name=count value=10></div>';
        mps.forEach (mp => {
          let li = document.createElement ('button');
          li.type = 'button';
          li.innerHTML = '<markedpoint-icon></markedpoint-icon> <bdi></bdi>';
          li.querySelector ('markedpoint-icon').textContent = mp.short_label;
          li.querySelector ('bdi').textContent = mp.label;
          li.onclick = (v) => {
            let mode = details.querySelector ('input[name=mode]:checked').value;
            let result = resultByTeam[ev.querySelector ('[name=rankingtype_id]').value];
            if (mode === 'passed') {
              list.querySelectorAll ('input[name=team]').forEach (input => {
                input.checked = !! ((result[input.value] || {})[mp.id] || {}).n;
              });
            } else if (mode === 'not_passed') {
              list.querySelectorAll ('input[name=team]').forEach (input => {
                input.checked = ! ((result[input.value] || {})[mp.id] || {}).n;
              });
            } else if (mode === 'top') {
              let count = details.querySelector ('input[name=count]').valueAsNumber;
              list.querySelectorAll ('input[name=team]').forEach (input => {
                let rank = ((result[input.value] || {})[mp.id] || {}).n;
                input.checked = rank && rank <= count;
              });
            }
            this.dispatchEvent (new Event ('change', {bubbles: true}));
            v.stopPropagation ();
          };
          details.appendChild (li);
        });
        els.push (details);
      } // mps
      
      let list = document.createElement ('ul');
      els.push (list);
      Object.values (teams).forEach (team => {
        let li = document.createElement ('li');
        li.innerHTML = '<label><input type=checkbox name=team checked> <team-icon></team-icon> <bdi></bdi></label>';
        li.querySelector ('input').value = team.id;
        li.querySelector ('team-icon').textContent = team.short_label;
        li.querySelector ('bdi').textContent = team.label;
        list.appendChild (li);
      });

      {
        let button = document.createElement ('button');
        button.type = 'button';
        button.textContent = '全選択解除';
        button.onclick = (ev) => {
          list.querySelectorAll ('input[name=team]').forEach (input => {
            input.checked = false;
          });
          this.dispatchEvent (new Event ('change', {bubbles: true}));
          ev.stopPropagation ();
        };
        els.push (button);
      }

      this.querySelectorAll ('rbr-list-main').forEach (c => {
        c.textContent = '';
        els.forEach (el => c.appendChild (el));
      });

      this.dispatchEvent (new Event ('change', {bubbles: true}));
    }, // rbrInit
  },
}); // <rbr-select-teams>

defineElement ({
  name: 'rbr-markedpoint-team-graph',
  props: {
    pcInit: function () {
      this.addEventListener ('change', () => {
        this.rbrInit ();
      });
      return this.rbrInit ();
    },
    rbrEvent: function () {
      let p = this.parentNode;
      while (p && p.localName !== 'rbr-event') p = p.parentNode;
      return p;
    },
    rbrInit: function () {
      let ev = this.rbrEvent ();
      if (!ev) return;
      
      let mpid = null;
      this.querySelectorAll ('[name=markedpoint_id]').forEach (_ => {
        mpid = _.value;
      });
      let rts = ev.rbrRankingTypes || {};
      let results = ev.rbrResults || [];

      // XXX tz
      let slotSize = 1800;
      let slots = {'-': true};
      let minSlot = Infinity;
      let maxSlot = -Infinity;
      let slotted = [];
      results.forEach (_ => {
        if (_.p == mpid) {
          let slot = _.n ? Math.floor (_.c / slotSize) * slotSize : '-';
          if (!_.n && _.d.m.length) {
            slot = '' + _.d.m.at (-1).l;
          }
          slots[slot] = true;
          if (slot < minSlot) minSlot = slot;
          if (maxSlot < slot) maxSlot = slot;

          if (!slotted[_.p]) slotted[_.p] = [];
          if (!slotted[_.p][_.r]) slotted[_.p][_.r] = {};
          slotted[_.p][_.r][slot] = (slotted[_.p][_.r][slot] || 0) + 1;
        }
      });

      {
        {
          let s = minSlot - slotSize * 2;
          while (s <= maxSlot + slotSize * 2) {
            slots[s] = true;
            s += slotSize;
          }
        }
        let slotNames = Object.keys (slots).map (_ => parseInt (_) || _).sort ((a, b) => typeof (a) < typeof (b) ? -1 : typeof (a) > typeof (b) ? +1 : a - b );
        let hasDay = 0;
        let slotLabels = slotNames.map ((_, index) => {
          if (typeof (_) === "number") {
            if (_ % 3600) {
              return '';
            } else {
              // XXX lang
              let digits = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
              let d = new Date(_ * 1000);
              let h = '' + d.getHours ();
              let hh = h.split ('').map (_ => digits[parseInt (_)]).join ('')
                  .replace (/^一〇$/, '十')
                  .replace (/^一(.)$/, '十$1')
                  .replace (/^二(.)$/, '二十$1')
                  .replace (/十〇$/, '十');
              let v = hh + '時';
              if (!hasDay++ || h === "0") {
                let day = '' + d.getDate ();
                let dd = day.split ('').map (_ => digits[parseInt (_)]).join ('')
                    .replace (/^一〇$/, '十')
                    .replace (/^一(.)$/, '十$1')
                    .replace (/^二(.)$/, '二十$1')
                    .replace (/^三(.)$/, '三十$1')
                    .replace (/十〇$/, '十');
                v += ' ' + dd + '日';
              }
              return v;
            }
          } else if (_ === '-') {
            return '未通過';
          } else {
            return _;
          }
        });
        // XXX lang
        let labels = Object.values (rts).map (_ => _.short_label || _.label || _.id);
        
        let div = document.createElement ('rbr-barsets-chart');
        div.style.minWidth = rts.length * (slotNames.length + 1) * 20 + "px";
        div.style.height = "30em";
        this.querySelectorAll ('rbr-graph-main').forEach (c => {
          c.textContent = '';
          c.appendChild (div);
        });
        
        let chart = new Chartist.Bar (div, {
          labels,
          series: slotNames.map (slot => Object.keys (rts).map (rtid => {
            return {
              x: rtid,
              y: (slotted[mpid][rtid] || {})[slot] || 0,
            };
          })),
        }, {
          chartPadding: 50,
          seriesBarDistance: 20,
          axisY: {
            onlyInteger: true,
            low: 0,
            scaleMinSpace: 20,
          },
          axisX: {
            //showLabel: false,
            offset: 80, // bottom
            labelInterpolationFnc: (value, index) => {
              return value;
            }
          },
        });
        chart.on ('draw', function (data) {
          if (data.type === 'bar') {
            chart.svg.elem ('text', {
              x: data.x2,
              y: data.y2 - 10,
            }, 'ct-label rbr-bar-value').text (data.value.y);

            let delta = (typeof (slotNames[data.seriesIndex]) === 'number') ? -10 : 0;
            data.group.elem ('text', {
              x: data.x1 + delta,
              y: data.y1 + 10,
            }, 'ct-label rbr-bar-desc').text (slotLabels[data.seriesIndex]);
          } else if (data.type === 'label' && data.axis.units.pos === 'x') {
            chart.svg.elem ('text', {
              x: data.x,
              y: data.axis.chartRect.y2 - 20,
            }, 'ct-label rbr-barset-label').text(data.text);

            data.element._node.classList.add ("rbr-redundant-label");
          }
        });
      }
    }, // rbrInit
  },
}); // <rbr-markedpoint-team-graph>

defineElement ({
  name: 'rbr-rank-graph',
  props: {
    pcInit: function () {
      this.addEventListener ('change', () => {
        this.rbrInit ();
      });
      return this.rbrInit ();
    },
    rbrEvent: function () {
      let p = this.parentNode;
      while (p && p.localName !== 'rbr-event') p = p.parentNode;
      return p;
    },
    rbrInit: function () {
      let ev = this.rbrEvent ();
      if (!ev) return;
      
      let rtid = null;
      this.querySelectorAll ('[name=rankingtype_id]').forEach (_ => {
        rtid = _.value;
      });

      let selectedTeamIds = [];
      this.querySelectorAll ('[name=team]:checked').forEach (_ => {
        selectedTeamIds[_.value] = true;
      });

      let mps = ev.rbrMarkedPoints || [];
      let rts = ev.rbrRankingTypes || {};
      let results = ev.rbrResults || [];

      let resultByTeam = {};
      results.forEach (_ => {
        if (_.p == 0) {
          //
        } else {
          resultByTeam[_.r] = resultByTeam[_.r] || {};
          resultByTeam[_.r][_.t] = resultByTeam[_.r][_.t] || {};
          resultByTeam[_.r][_.t][_.p] = _;
        }
      });

      let teams = (ev.rbrTeams || []).filter (_ => (resultByTeam[rtid] || [])[_.id]);
      let filteredTeams = teams.filter (_ => selectedTeamIds[_.id]);

      {
        let maxRank = 1;
        let dts = filteredTeams.map(team => {
          let data = mps.map(_ => {
            return {
              x: _.start_distance,
              y: (resultByTeam[rtid][team.id][_.id] || {}).n || null
            };
          });
          maxRank = Math.max (maxRank, Math.max.apply(null, data.map(_ => _.y)));
          return {
            team,
            data: data.map(_ => ({x: _.x, y: _.y}))
          };
        });

        let div = document.createElement ('rbr-rank-chart');
        let yDelta = 20;
        div.style.height = "calc(max(30em, "+yDelta*filteredTeams.length+"px))";
        let chart = new Chartist.Line (div, {
          // XXX lang
          labels: mps.map(_ => _.short_label || _.label || _.id),
          series: dts.map(ds => ds.data.map (_ => ({x: _.x, y: Number.isFinite (_.y) ? maxRank - _.y : NaN})))
        }, {
          axisX: {
            labelInterpolationFnc: function (value, index) {
              let mp = mps[index];
              return mp.short_label || mp.label || mp.id;
            },
            type: Chartist.FixedScaleAxis,
            ticks: mps.map (_ => _.start_distance),
          },
          axisY: {
            onlyInteger: true,
            high: maxRank - (1 - 2),
            low: maxRank - (maxRank + 2),
        labelInterpolationFnc: function (value) {
          let v = maxRank - value;
          return v >= 1 ? v : '';
        }
      },
      lineSmooth: Chartist.Interpolation.cardinal({
        tension: 0,
      }),
      showPoint: true,
          fullWidth: true,
          chartPadding: {
            right: 200,
          },
        });
        let teamItems = [];
        chart.on ('draw', function (data) {
          if (data.type === 'point') {
            let team = dts[data.seriesIndex].team;
            teamItems[team.id] = [data.group, data.x, data.y, team, data.index];
          }
        });
        chart.on ('created', function (data) {
          let nextY = yDelta;
          teamItems.sort ((a, b) => a[4] === 0 ? +1 : b[4] === 0 ? -1 : a[2]-b[2]).forEach (([g, pX, pY, team]) => {
            
            let x = data.axisX.chartRect.x2 + 40;
            if (nextY < pY) nextY = pY;
            let y = nextY;
            nextY += yDelta;

            g.elem ('line', {
              x1: pX + 10,
              y1: pY,
              x2: x,
              y2: y,
            }, 'ct-line rbr-team-desc-pointer');
            
            g.elem ('text', {
              x: x + 5,
              y,
            }, 'ct-label rbr-team-desc').text ('[' + team.short_label + '] ' + team.label);
              // XXX lang
          });
        });

        this.querySelectorAll ('rbr-graph-main').forEach (c => {
          c.textContent = '';
          c.appendChild (div);
        });
      }
    }, // rbrInit
  },
}); // <rbr-rank-graph>


/*
  
Copyright 2019-2024 Wakaba <wakaba@suikawiki.org>.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Affero General Public License for more details.

You does not have received a copy of the GNU Affero General Public
License along with this program, see <https://www.gnu.org/licenses/>.

*/
