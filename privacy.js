'use strict';
document.querySelector('#clear-local').addEventListener('click',()=>{
  try{localStorage.removeItem('dealhound-watchlist');document.querySelector('#clear-status').textContent='Earlier browser data removed.';}
  catch{document.querySelector('#clear-status').textContent='Browser storage is unavailable.';}
});
