/* Original reflection cards for the game's PBR materials. No external HDRI.
 * Cached per renderer; generated once rather than rebuilt at every scene cut. */
(function(global){
  'use strict';
  var T=global.THREE;if(!T)return;
  var cache=new WeakMap();
  function reflectionCube(warm){
    var faces=[];
    for(var i=0;i<6;i++){
      var c=document.createElement('canvas');c.width=c.height=128;var g=c.getContext('2d');
      var ramp=g.createLinearGradient(0,0,0,128);
      ramp.addColorStop(0,warm?'#8e8170':'#8994a4');ramp.addColorStop(.58,warm?'#49403a':'#42474e');ramp.addColorStop(1,'#17191d');
      g.fillStyle=ramp;g.fillRect(0,0,128,128);
      if(i===2){g.fillStyle=warm?'#ada08c':'#9aa7b8';g.fillRect(0,0,128,128);}
      if(i===3){g.fillStyle='#1b1918';g.fillRect(0,0,128,128);}
      if(i===0||i===1||i===4){
        var x=i===0?12:i===1?72:32,width=i===4?64:36;
        var card=g.createLinearGradient(x,0,x+width,0);
        card.addColorStop(0,'rgba(220,219,213,0)');card.addColorStop(.20,warm?'#e2d3b9':'#dce6ef');card.addColorStop(.8,warm?'#e2d3b9':'#dce6ef');card.addColorStop(1,'rgba(220,219,213,0)');
        g.fillStyle=card;g.fillRect(x,12,width,i===4?62:88);
      }
      faces.push(c);
    }
    var cube=new T.CubeTexture(faces);cube.encoding=T.sRGBEncoding;cube.needsUpdate=true;return cube;
  }
  function install(scene,renderer,theme){
    var profiles=cache.get(renderer);if(!profiles){profiles={};cache.set(renderer,profiles);}
    var key=theme==='warm'?'warm':'neutral';
    if(!profiles[key]){
      var source=reflectionCube(key==='warm'),generator=new T.PMREMGenerator(renderer);
      try{
        var target=generator.fromCubemap(source);profiles[key]={texture:target.texture,target:target};
      }finally{source.dispose();generator.dispose();}
    }
    scene.environment=profiles[key].texture;
  }
  global.KM_LIGHTING={install:install};
})(typeof window!=='undefined'?window:this);
