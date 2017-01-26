// standard defines for win app - https://msdn.microsoft.com/en-us/library/bb384843.aspx
#define WIN32
#define UNICODE
#define _UNICODE
#define _WINDOWS

// standard includes for win app - https://msdn.microsoft.com/en-us/library/bb384843.aspx
#include <windows.h>
#include <stdlib.h>
#include <string.h>
#include <tchar.h>

// start - debug
#include <utility>
#include <fstream>
#include <string>
#include <chrono> // debug time

template <typename HeadType> bool
debug_log_rec(std::ostream& out, HeadType&& head) {
	out << head;
	out << std::endl;
	return true;
}

template <typename HeadType, typename... TailTypes> bool
debug_log_rec(std::ostream& out, HeadType&& head, TailTypes&&... tails) {
	out << head;
	out << " ";
	debug_log_rec(out, std::forward<TailTypes>(tails)...);
	return true;
}

template <typename... ArgTypes> bool
debug_log(ArgTypes&&... args) {
	// return true; // prod
	std::fstream fs;
	fs.open("log.txt", std::fstream::app);
	debug_log_rec(fs, std::forward<ArgTypes>(args)...);
	fs.close();
	return true;
}

int nowms() {
	using namespace std::chrono;
	milliseconds ms = duration_cast<milliseconds>(system_clock::now().time_since_epoch());
	return ms.count();
}
// end - debug

bool read_u32(uint32_t* data) {
	return std::fread(reinterpret_cast<char*>(data), sizeof(uint32_t), 1, stdin) == 1;
}

bool read_string(std::string &str, uint32_t length) {
	str.resize(length);
	return std::fread(&str[0], sizeof(char), str.length(), stdin) == length;
}

bool write_u32(uint32_t data) {
	return std::fwrite(reinterpret_cast<char*>(&data), sizeof(uint32_t), 1, stdout) == 1;
}

bool write_string(const std::string &str) {
	return std::fwrite(&str[0], sizeof(char), str.length(), stdout) == str.length();
}

bool get_message(std::string& str) {
	uint32_t length;
	debug_log("reading length");
	while (true) {
		if (!read_u32(&length)) {
			// debug_log("failed to read length", "SHOULD I RETRY?");
			// return false; // comment this if you want retry
			continue; // uncomment this if you want retry
		}
		break;
	}
	debug_log("length:", length);
	debug_log("reading string");
	while (true) {
		if (!read_string(str, length)) {
			// debug_log("failed to read string", "SHOULD I RETRY?");
			// return false; // comment this if you want retry
			continue; // uncomment this if you want retry
		}
		break;
	}
	debug_log("read string: [" + str + "]");
	// debug_log(str.length());
	return true;
}

bool send_message(const std::string& str) {
	//debug_log("writing length");
	while (!write_u32(str.length())) {
		debug_log("failed to write length, for str:", str, "WILL RETRY");
	}
	//debug_log("writing string");
	while (!write_string(str)) {
		debug_log("failed to write string, for str:", str, "WILL RETRY");
	}
	//debug_log("flushing");
	while (std::fflush(stdout) != 0) {
		debug_log("failed to flush, for str:", str, "WILL RETRY");
	}
	return true;
}

int main(void) {
	debug_log("startup");

	std::string payload_str;
	while (get_message(payload_str)) {
		debug_log("payload_str:", payload_str);
        if (payload_str == "\"ping\"") {
            send_message("\"pong\"");
        }
	}


	debug_log("ending");

	return 0;
}
