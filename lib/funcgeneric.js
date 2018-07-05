/*****************************************************************************************************
* 	Filename	: funcgeneric.js	
*	Author		: Sathrak Paldurai K
*	Date		: 04-07-2018	
******************************************************************************************************/
	
	exports.empty = function(mixedVar) {
		// *     example 3: empty([]);
		// *     returns 3: true
		var undef
		var key
		var i
		var len
		var emptyValues = [undef, null, false, 0, '', '0']
		for (i = 0, len = emptyValues.length; i < len; i++) {
			if (mixedVar === emptyValues[i]) {
				return true
			}
		}
		if (typeof mixedVar === 'object') {
			for (key in mixedVar) {
				if (mixedVar.hasOwnProperty(key)) {
					return false
				}
			}
			return true
		}
		return false
	}
	
	exports.UnixTimeStamp = function(){
		return Math.floor(new Date().getTime() / 1000);
	}
	
	exports.millisecTime = function(){
		return new Date().getTime();
	}	