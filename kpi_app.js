// ========== 多月份支持 ==========
// ALL_DATA 格式: {"2月": [...], "3月": [...]} 或兼容旧格式 [...]
var MONTH_DATA;
if (Array.isArray(ALL_DATA)) {
  MONTH_DATA = {"2月": ALL_DATA};
} else {
  MONTH_DATA = ALL_DATA;
}
var MONTHS = Object.keys(MONTH_DATA);
var DATA = [];

// 初始化月份下拉
(function initMonthSelect() {
  var sel = document.getElementById('month-select');
  MONTHS.forEach(function(m) {
    var opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  });
  // 默认选最新月份（最后一个）
  sel.value = MONTHS[MONTHS.length - 1];
})();

// SABCD等级划分
function getGrade(score) {
  if (score >= 95) return 'S';
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}
function gColor(g) {
  return {S:'#ff6b35',A:'#4caf50',B:'#2196f3',C:'#ff9800',D:'#f44336'}[g]||'#999';
}

// ========== 图表实例 ==========
var chartDept, chartGrade, chartRadar, chartScatter, modalChart;
var activeGrade = null;
var activeDept = null;

// ========== 切换月份入口 ==========
function switchMonth(month) {
  DATA = MONTH_DATA[month] || [];
  activeGrade = null;
  activeDept = null;
  renderAll();
}

// ========== 计算 + 渲染所有 ==========
function renderAll() {
  if (!DATA.length) return;

  // 计算部门数据
  var deptMap = {};
  DATA.forEach(function(p) {
    if (!deptMap[p.dept]) deptMap[p.dept] = [];
    deptMap[p.dept].push(p);
  });
  var deptNames = Object.keys(deptMap);
  var deptAvg = {};
  deptNames.forEach(function(d) {
    var arr = deptMap[d];
    deptAvg[d] = +(arr.reduce(function(s,p){return s+p.score},0) / arr.length).toFixed(1);
  });

  var sorted = DATA.slice().sort(function(a,b){return b.score - a.score});
  var totalAvg = +(DATA.reduce(function(s,p){return s+p.score},0) / DATA.length).toFixed(1);
  var maxScore = sorted[0].score.toFixed(1);
  var minScore = sorted[sorted.length-1].score.toFixed(1);

  var gradeCount = {S:0,A:0,B:0,C:0,D:0};
  var gradePersons = {S:[],A:[],B:[],C:[],D:[]};
  DATA.forEach(function(p) {
    var g = getGrade(p.score);
    gradeCount[g]++;
    gradePersons[g].push(p);
  });

  // ========== 总览数字 ==========
  document.getElementById('ov-nums').innerHTML =
    '<div class="ov-item"><div class="num">'+DATA.length+'</div><div class="label">考核人数</div></div>'+
    '<div class="ov-item"><div class="num">'+deptNames.length+'</div><div class="label">事业部</div></div>'+
    '<div class="ov-item"><div class="num">'+totalAvg+'</div><div class="label">集团均分</div></div>'+
    '<div class="ov-item"><div class="num">'+maxScore+'</div><div class="label">最高分</div></div>'+
    '<div class="ov-item"><div class="num">'+minScore+'</div><div class="label">最低分</div></div>';

  // ========== 部门柱状图 ==========
  if (!chartDept) {
    chartDept = echarts.init(document.getElementById('chart-dept'));
    chartDept.on('click', function(p){filterByDept(deptNames[p.dataIndex])});
  }
  chartDept.setOption({
    tooltip:{trigger:'axis',backgroundColor:'#1a2940',borderColor:'#1e3a5f',textStyle:{color:'#e0e8f0',fontSize:11}},
    grid:{left:50,right:10,top:10,bottom:24},
    xAxis:{type:'category',data:deptNames.map(function(d){return d.replace('品质','')}),axisLabel:{color:'#7eb8da',fontSize:10},axisLine:{lineStyle:{color:'#1e3a5f'}}},
    yAxis:{type:'value',min:0,max:100,axisLabel:{color:'#7eb8da',fontSize:10},splitLine:{lineStyle:{color:'#1a2d45'}}},
    series:[{type:'bar',barWidth:24,
      data:deptNames.map(function(d){return{value:deptAvg[d],itemStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#4fc3f7'},{offset:1,color:'#1e90ff'}])}}}),
      label:{show:true,position:'top',color:'#4fc3f7',fontSize:10,formatter:function(p){return p.value.toFixed(1)}}
    }]
  }, true);

  // ========== SABCD 等级 ==========
  var grades = ['S','A','B','C','D'];
  var gradeLabels = {S:'S(≥95)',A:'A(85-94)',B:'B(75-84)',C:'C(60-74)',D:'D(<60)'};

  function renderGradeBadges() {
    document.getElementById('grade-badges').innerHTML = grades.map(function(g) {
      return '<div class="grade-badge grade-'+g.toLowerCase()+(activeGrade===g?' active':'')+'" onclick="toggleGrade(\''+g+'\')">'+gradeLabels[g]+':'+gradeCount[g]+'人</div>';
    }).join('');
  }
  renderGradeBadges();

  // toggleGrade / filterByDept 需要闭包访问
  window.toggleGrade = function(g) {
    activeGrade = activeGrade===g ? null : g;
    renderGradeBadges();
    renderRankTable();
  };

  if (!chartGrade) {
    chartGrade = echarts.init(document.getElementById('chart-grade'));
    chartGrade.on('click', function(p){window.toggleGrade(p.name.replace('级',''))});
  }
  chartGrade.setOption({
    tooltip:{trigger:'item',backgroundColor:'#1a2940',borderColor:'#1e3a5f',textStyle:{color:'#e0e8f0'}},
    series:[{type:'pie',radius:['35%','65%'],center:['50%','50%'],
      label:{color:'#e0e8f0',fontSize:10,formatter:'{b}:{c}人'},
      data:grades.map(function(g){return{name:g+'级',value:gradeCount[g],itemStyle:{color:gColor(g)}}})
    }]
  }, true);

  // ========== TOP3 / BOTTOM3 ==========
  var medals = ['\ud83e\udd47','\ud83e\udd48','\ud83e\udd49'];
  function renderTop3(id, list, color) {
    document.getElementById(id).innerHTML = list.map(function(p,i) {
      return '<div class="top-item" onclick="openModal('+p.id+')"><span class="medal">'+medals[i]+'</span><span>'+p.name+'</span><span style="font-size:10px;color:#7eb8da">'+p.dept.replace('品质','')+'</span><span class="sc" style="color:'+color+'">'+p.score.toFixed(1)+'</span></div>';
    }).join('');
  }
  renderTop3('top3-list', sorted.slice(0,3), '#4caf50');
  renderTop3('bottom3-list', sorted.slice(-3).reverse(), '#f44336');

  // ========== 雷达图 ==========
  if (!chartRadar) chartRadar = echarts.init(document.getElementById('chart-radar'));
  chartRadar.setOption({
    tooltip:{backgroundColor:'#1a2940',borderColor:'#1e3a5f',textStyle:{color:'#e0e8f0'}},
    radar:{
      indicator:deptNames.map(function(d){return{name:d.replace('品质',''),max:100}}),
      shape:'polygon',radius:'65%',
      axisName:{color:'#7eb8da',fontSize:9},
      splitArea:{areaStyle:{color:['rgba(30,144,255,.05)','rgba(30,144,255,.1)']}},
      splitLine:{lineStyle:{color:'#1e3a5f'}},axisLine:{lineStyle:{color:'#1e3a5f'}}
    },
    series:[{type:'radar',
      data:[{value:deptNames.map(function(d){return deptAvg[d]}),name:'事业部均分',
        areaStyle:{color:'rgba(79,195,247,.2)'},lineStyle:{color:'#4fc3f7'},itemStyle:{color:'#4fc3f7'}}]
    }]
  }, true);

  // ========== 散点图 ==========
  if (!chartScatter) {
    chartScatter = echarts.init(document.getElementById('chart-scatter'));
    chartScatter.on('click', function(p){if(p.data&&p.data[2])window.openModal(p.data[2])});
  }
  var scatterData = DATA.map(function(p,i){return [i, p.score, p.id, p.name, p.dept]});
  chartScatter.setOption({
    tooltip:{backgroundColor:'#1a2940',borderColor:'#1e3a5f',textStyle:{color:'#e0e8f0',fontSize:11},
      formatter:function(p){return p.data[3]+'('+p.data[4].replace('品质','')+')<br>得分:'+p.data[1].toFixed(1)}},
    grid:{left:40,right:10,top:10,bottom:30},
    xAxis:{type:'value',show:false,min:0,max:DATA.length-1},
    yAxis:{type:'value',min:0,max:100,axisLabel:{color:'#7eb8da',fontSize:10},splitLine:{lineStyle:{color:'#1a2d45'}}},
    series:[{type:'scatter',symbolSize:10,
      data:scatterData,
      itemStyle:{color:function(p){var s=p.data[1];return s>=95?'#ff6b35':s>=85?'#4caf50':s>=75?'#2196f3':s>=60?'#ff9800':'#f44336'}}
    }]
  }, true);

  // ========== 排名表 ==========
  // 部门筛选按钮
  document.getElementById('dept-filter').innerHTML =
    '<div class="dept-btn'+(activeDept===null?' active':'')+'" onclick="filterByDept(null)">全部</div>'+
    deptNames.map(function(d){
      return '<div class="dept-btn'+(activeDept===d?' active':'')+'" onclick="filterByDept(\''+d+'\')">'+d.replace('品质','')+'</div>';
    }).join('');

  window.filterByDept = function(d) {
    activeDept = activeDept===d ? null : d;
    document.getElementById('dept-filter').innerHTML =
      '<div class="dept-btn'+(activeDept===null?' active':'')+'" onclick="filterByDept(null)">全部</div>'+
      deptNames.map(function(dd){
        return '<div class="dept-btn'+(activeDept===dd?' active':'')+'" onclick="filterByDept(\''+dd+'\')">'+dd.replace('品质','')+'</div>';
      }).join('');
    renderRankTable();
  };

  function renderRankTable() {
    var list = sorted;
    if (activeDept) list = list.filter(function(p){return p.dept===activeDept});
    if (activeGrade) list = list.filter(function(p){return getGrade(p.score)===activeGrade});
    var html = '';
    list.forEach(function(p, i) {
      var rank = i + 1;
      var g = getGrade(p.score);
      var pct = p.score;
      var barColor = gColor(g);
      var rankCls = rank <= 3 ? ' rank-'+rank : '';
      html += '<tr><td><span class="rank-num'+rankCls+'">'+rank+'</span></td>'+
        '<td class="clickable" onclick="openModal('+p.id+')">'+p.name+'</td>'+
        '<td>'+p.dept.replace('品质','')+'</td>'+
        '<td style="font-weight:600">'+p.score.toFixed(1)+'</td>'+
        '<td><span class="grade-badge grade-'+g.toLowerCase()+'" style="font-size:8px;padding:1px 4px">'+g+'</span></td>'+
        '<td><div class="score-bar"><div class="score-bar-fill" style="width:'+pct+'%;background:'+barColor+'"></div></div></td></tr>';
    });
    document.getElementById('rank-tbody').innerHTML = html;
  }
  renderRankTable();

  // ========== 个人详情弹窗 ==========
  window.openModal = function(id) {
    var p = DATA.find(function(x){return x.id===id});
    if (!p) return;
    var g = getGrade(p.score);
    document.getElementById('modal-title').textContent = p.name + ' · ' + p.dept + ' · 个人KPI详情';
    document.getElementById('modal-score-info').innerHTML =
      '<span style="font-size:22px;font-weight:700;color:'+gColor(g)+'">'+p.score.toFixed(1)+'</span>'+
      '<span style="font-size:12px;color:#7eb8da;margin-left:6px">'+g+'级</span>';

    // 隐藏图表区域，用表格替代
    document.getElementById('modal-chart').style.display = 'none';

    document.getElementById('modal-kpis').innerHTML =
      '<table style="width:100%;border-collapse:collapse;font-size:11px">' +
      '<thead><tr>' +
      '<th style="background:#162a4a;color:#81d4fa;padding:6px 8px;text-align:left;white-space:nowrap">指标</th>' +
      '<th style="background:#162a4a;color:#81d4fa;padding:6px 8px;text-align:center;width:60px">权重</th>' +
      '<th style="background:#162a4a;color:#81d4fa;padding:6px 8px;text-align:center;width:70px">实际值</th>' +
      '<th style="background:#162a4a;color:#81d4fa;padding:6px 8px;text-align:center;width:70px">达成率</th>' +
      '<th style="background:#162a4a;color:#81d4fa;padding:6px 8px;text-align:center;width:80px">得分</th>' +
      '<th style="background:#162a4a;color:#81d4fa;padding:6px 8px;text-align:left;width:120px">达成</th>' +
      '</tr></thead><tbody>' +
      p.kpis.map(function(k) {
        var maxS = k.weight * 100;
        var pct = maxS > 0 ? (k.score / maxS * 100) : 0;
        var bc = pct >= 90 ? '#4caf50' : pct >= 70 ? '#2196f3' : pct >= 50 ? '#ff9800' : '#f44336';
        return '<tr style="border-bottom:1px solid #1a2d45">' +
          '<td style="padding:6px 8px;color:#e0e8f0">'+k.indicator+'</td>' +
          '<td style="padding:6px 8px;text-align:center;color:#7eb8da">'+(k.weight*100).toFixed(1)+'%</td>' +
          '<td style="padding:6px 8px;text-align:center;color:#7eb8da">'+(k.actual!==null?Number(k.actual).toFixed(1):'-')+'</td>' +
          '<td style="padding:6px 8px;text-align:center;color:#7eb8da">'+(k.rate!==null?(k.rate*100).toFixed(1)+'%':'-')+'</td>' +
          '<td style="padding:6px 8px;text-align:center;font-weight:700;color:'+bc+'">'+k.score.toFixed(1)+'/'+maxS.toFixed(1)+'</td>' +
          '<td style="padding:6px 8px"><div style="height:6px;background:#0f1923;border-radius:3px;overflow:hidden"><div style="height:100%;width:'+Math.min(pct,100).toFixed(1)+'%;background:'+bc+';border-radius:3px"></div></div></td>' +
          '</tr>';
      }).join('') +
      '</tbody></table>';

    document.getElementById('modal').classList.add('show');
  };

  window.closeModal = function() {
    document.getElementById('modal').classList.remove('show');
  };
}

// ========== 初始化 ==========
setTimeout(function() {
  switchMonth(document.getElementById('month-select').value);
}, 100);

window.addEventListener('resize', function() {
  if (chartDept) chartDept.resize();
  if (chartGrade) chartGrade.resize();
  if (chartRadar) chartRadar.resize();
  if (chartScatter) chartScatter.resize();
  if (modalChart) modalChart.resize();
});
