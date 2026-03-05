export class Random {
	last_number : number = -1

	static getRandomFloat(min:number, max:number) {
		return Math.random() * (max - min) + min
	}
	static getRandomInt(min:number, max:number) {
		const rnd_number = Math.floor(Math.random() * (max - min + 1)) + min
		return rnd_number
	}
	static getRandomItem<T>(arr: T[]) : T {
		if(arr.length == 0) {
			throw new Error("Array is empty")
		} 
		return arr[Random.getRandomInt(0, arr.length - 1)]
	}
}