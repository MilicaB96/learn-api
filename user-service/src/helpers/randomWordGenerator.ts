const chars =
	'0123456789abcdefghijklmnopqrstuvwxyz!@#$%^&*()ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const randomWordGenerator = (length: number): string => {
	let word = '';
	for (var i = 0; i <= length; i++) {
		var randomNumber = Math.floor(Math.random() * chars.length);
		word += chars.substring(randomNumber, randomNumber + 1);
	}
	return word;
};
